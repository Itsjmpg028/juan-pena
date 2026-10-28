// Seguimiento de lotes: arma, a partir de las hojas del libro APP JAMAR, una fila por lote con su recorrido
// Entrada (Inventario) → Asignación → Ebanistería → Acabados → Costura → Tapicería → Empaque → Inspección.
// Funciones puras: se usan en seguimiento.html y se pueden probar en Node.
(function (root) {
  const clave = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9#]/gi, '').toLowerCase();
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  // "27/10/2026" o "27/10/2026 8:06:31" -> "2026-10-27"
  const isoDate = (s) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '').trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  };
  // "27/10/2026 8:06:31" -> "2026-10-27 08:06:31" (ordenable). Sin hora -> fecha + " 00:00:00".
  const isoDT = (s, fecha) => {
    const t = String(s || '').trim();
    const d = isoDate(t) || isoDate(fecha);
    if (!d) return null;
    const h = /(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(t.slice(10));
    return h ? `${d} ${h[1].padStart(2, '0')}:${h[2]}:${(h[3] || '00')}` : `${d} 00:00:00`;
  };
  const num = (s) => { const t = String(s ?? '').trim().replace(/\./g, '').replace(',', '.'); return t === '' || isNaN(Number(t)) ? null : Number(t); };
  // Lote real: 6 a 8 dígitos. Un lote escrito con "2026" pegado al final se lee sin el "2026".
  const loteNorm = (l) => { let s = String(l ?? '').trim(); if (/^\d{6,8}2026$/.test(s)) s = s.slice(0, -4); return s; };
  const esLote = (l) => /^\d{6,8}$/.test(l);

  const columnas = (header, mapa) => {
    const h = header.map(clave);
    const out = {};
    for (const [campo, nombres] of Object.entries(mapa)) out[campo] = h.findIndex((x) => nombres.map(clave).includes(x));
    return out;
  };
  const tabla = (values, mapa) => {
    const [header = [], ...rows] = values;
    const k = columnas(header, mapa);
    const faltan = Object.entries(k).filter(([, i]) => i < 0).map(([c]) => c);
    return {
      faltan,
      rows: rows.filter((r) => r.some((c) => String(c).trim() !== '')).map((r) => {
        const o = {};
        for (const [c, i] of Object.entries(k)) o[c] = i >= 0 ? String(r[i] ?? '').trim() : '';
        return o;
      }),
    };
  };

  const AREAS = [
    { id: 'eban', label: 'Ebanistería' },
    { id: 'acab', label: 'Acabados' },
    { id: 'cost', label: 'Costura' },
    { id: 'tapi', label: 'Tapicería' },
    { id: 'emp', label: 'Empaque' },
  ];
  // El empaque se registra como TIPO DE SERVICIO = EMPAQUE (casi siempre por técnicos de Tapicería).
  const areaDe = (area, tipo) => {
    const a = norm(area), t = norm(tipo);
    if (t.includes('EMPAQUE') || a === 'EMPAQUE') return 'emp';
    if (a.startsWith('EBANISTER')) return 'eban';
    if (a.startsWith('ACABADO') || a === 'POLICHE' || a === 'PINTURA') return 'acab';
    if (a.startsWith('COSTURA')) return 'cost';
    if (a.startsWith('TAPICER')) return 'tapi';
    return null;
  };
  const TALLER = ['2000', '2001', '2006'];
  const VENTA = ['2500', '2503', '2506', '2508'];
  const tipoCentro = (c) => (TALLER.includes(c) ? 'Taller' : VENTA.includes(c) ? 'Venta' : c ? 'Otro' : '');

  const MAPAS = {
    registros: {
      fecha: ['FECHA'], fecha_hora: ['FECHA HORA'], tecnico: ['TÉCNICO', 'TECNICO'], area: ['ÁREA', 'AREA'], lote: ['Lote'],
      producto: ['PRODUCTO'], pieza: ['PIEZA O MODULO'], tipo: ['TIPO DE SERVICIO'], piezas: ['# DE PIEZAS'], centro: ['CENTRO DESTINO'],
    },
    asignacion: {
      lote: ['Lote'], fecha: ['Fecha de Asignación'], fecha_hora: ['Fecha_hora asignación'], producto: ['Producto'],
      eban: ['Técnico 1 - Ebanistería'], tapi: ['Técnico 2 - Tapicería'], p_eban: ['Piezas Ebanista'], p_tapi: ['Piezas Tapicero'], centro: ['Centro'],
    },
    inspeccion: {
      fecha: ['FECHA'], fecha_hora: ['FECHA HORA'], inspector: ['INSPECTOR'], origen: ['ORIGEN'], lote: ['Lote'], producto: ['PRODUCTO'],
      centro: ['CENTRO'], resultado: ['RESULTADO'], reproceso: ['ÁREA A REPROCESAR'], obs: ['OBSERVACIONES'],
    },
    inventario: { centro: ['Centro'], fecha: ['Fe.contabilización'], producto: ['Texto breve de material', 'Producto'], lote: ['Lote'] },
  };

  const dias = (a, b) => (a && b ? Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) : null);

  // values: { registros, asignacion, inspeccion, inventario? } como arreglos de filas (encabezado en la primera).
  function construir(values, hoy) {
    const avisos = [];
    const t = {};
    for (const n of Object.keys(MAPAS)) {
      if (!values[n]) { t[n] = { rows: [], faltan: [] }; continue; }
      t[n] = tabla(values[n], MAPAS[n]);
      const req = n === 'inventario' ? ['lote', 'fecha'] : ['lote', 'fecha'];
      const falt = t[n].faltan.filter((c) => req.includes(c));
      if (falt.length) avisos.push(`La hoja ${n} no tiene las columnas: ${falt.join(', ')}`);
    }
    const lotes = new Map();
    const get = (l) => {
      if (!lotes.has(l)) lotes.set(l, { lote: l, regs: [], asig: [], insp: [] });
      return lotes.get(l);
    };

    for (const r of t.registros.rows) {
      const l = loteNorm(r.lote);
      if (!esLote(l)) continue; // 101/102 y valores que no son lotes no se siguen
      const fecha = isoDate(r.fecha);
      if (!fecha) continue;
      get(l).regs.push({ ...r, fecha, dt: isoDT(r.fecha_hora, r.fecha), area_id: areaDe(r.area, r.tipo), piezas: num(r.piezas) });
    }
    for (const r of t.asignacion.rows) {
      const l = loteNorm(r.lote);
      if (!esLote(l)) continue;
      get(l).asig.push({ ...r, fecha: isoDate(r.fecha) || isoDate(r.fecha_hora), dt: isoDT(r.fecha_hora, r.fecha) });
    }
    for (const r of t.inspeccion.rows) {
      const l = loteNorm(r.lote);
      if (!esLote(l)) continue;
      const fecha = isoDate(r.fecha) || isoDate(r.fecha_hora);
      if (!fecha) continue;
      get(l).insp.push({ ...r, fecha, dt: isoDT(r.fecha_hora, r.fecha), resultado: norm(r.resultado) });
    }
    // Inventario: solo para los lotes que se siguen (fechas de entrada, centro y producto).
    const inv = new Map();
    for (const r of t.inventario.rows) {
      const l = loteNorm(r.lote);
      if (!lotes.has(l)) continue;
      const fecha = isoDate(r.fecha);
      if (!fecha) continue;
      if (!inv.has(l)) inv.set(l, []);
      inv.get(l).push({ fecha, centro: r.centro, producto: r.producto });
    }

    const out = [];
    for (const L of lotes.values()) {
      L.regs.sort((a, b) => (a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0));
      L.asig.sort((a, b) => (a.dt < b.dt ? -1 : 1));
      L.insp.sort((a, b) => (a.dt < b.dt ? -1 : 1));
      const asig = L.asig[L.asig.length - 1] || null; // la asignación más reciente manda
      const insp = L.insp[L.insp.length - 1] || null; // la inspección más reciente manda
      const aprobado = insp && insp.resultado === 'APROBADO';
      const reproArea = insp && insp.resultado === 'REPROCESO' ? areaDe(insp.reproceso, '') : null;

      const inicio = (asig && asig.fecha) || (L.regs[0] && L.regs[0].fecha) || null;
      const entradas = (inv.get(L.lote) || []).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      const ref = inicio || (insp && insp.fecha) || hoy;
      const previas = entradas.filter((e) => e.fecha <= ref);
      const entrada = previas[previas.length - 1] || entradas[entradas.length - 1] || null;

      const ultimoReg = L.regs[L.regs.length - 1];
      const centro = (asig && asig.centro) || (ultimoReg && ultimoReg.centro) || (insp && insp.centro) || (entrada && entrada.centro) || '';
      const producto = (asig && asig.producto) || (ultimoReg && ultimoReg.producto) || (insp && insp.producto) || (entrada && entrada.producto) || '';

      const celdas = {};
      for (const A of AREAS) {
        const regs = L.regs.filter((r) => r.area_id === A.id);
        const asignado = asig && (A.id === 'eban' ? asig.eban : A.id === 'tapi' ? asig.tapi : '') || '';
        const piezasAsig = asig ? num(A.id === 'eban' ? asig.p_eban : A.id === 'tapi' ? asig.p_tapi : null) : null;
        const tecnicos = [...new Set(regs.slice().reverse().map((r) => r.tecnico).filter(Boolean))];
        const ultima = regs.length ? regs[regs.length - 1].fecha : null;
        let estado;
        if (reproArea === A.id) {
          const despues = regs.filter((r) => r.dt > insp.dt);
          estado = despues.length ? 'verde' : 'reproceso';
        } else if (regs.length) estado = 'verde';
        else if (asignado) estado = aprobado ? 'sinreg' : 'rojo';
        else estado = 'gris';
        celdas[A.id] = { estado, tecnicos, ultima, asignado, piezasAsig, regs, piezas: regs.reduce((s, r) => s + (r.piezas || 0), 0) };
      }

      let estado;
      if (insp && insp.resultado === 'APROBADO') estado = 'Listo';
      else if (insp && insp.resultado === 'REPROCESO') estado = 'Reproceso';
      else if (L.regs.length) {
        const asignadas = AREAS.filter((A) => celdas[A.id].asignado);
        const completas = asignadas.length && asignadas.every((A) => celdas[A.id].estado === 'verde');
        estado = celdas.emp.estado === 'verde' || completas ? 'Por inspeccionar' : 'En proceso';
      } else if (asig) estado = 'Por iniciar';
      else estado = 'Por iniciar';

      const fin = aprobado ? insp.fecha : null;
      const fechas = [asig && asig.fecha, ...L.regs.map((r) => r.fecha), ...L.insp.map((i) => i.fecha)].filter(Boolean).sort();
      out.push({
        lote: L.lote,
        producto,
        centro,
        tipo: tipoCentro(centro),
        entrada: entrada ? entrada.fecha : null,
        entradas: entradas.map((e) => e.fecha),
        asignacion: asig ? asig.fecha : null,
        asignaciones: L.asig.length,
        inicio,
        celdas,
        insp,
        inspecciones: L.insp,
        estado,
        fin,
        d_entrada_inicio: dias(entrada && entrada.fecha, inicio),
        d_inicio_fin: dias(inicio, fin || hoy),
        d_total: dias(entrada && entrada.fecha, fin || hoy),
        abierto: !fin,
        ultimo_mov: fechas[fechas.length - 1] || null,
        tecnicos: [...new Set([asig && asig.eban, asig && asig.tapi, ...L.regs.map((r) => r.tecnico)].filter(Boolean))],
        regs: L.regs,
      });
    }
    return { lotes: out, avisos };
  }

  const api = { construir, AREAS, areaDe, tipoCentro, isoDate, isoDT, loteNorm, dias };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Seguimiento = api;
})(typeof window !== 'undefined' ? window : globalThis);
