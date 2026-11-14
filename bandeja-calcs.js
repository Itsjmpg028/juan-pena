// Bandeja del supervisor: a partir de los lotes que arma Seguimiento.construir(), lo que necesita atención hoy.
//  1. Asignaciones sin registro: el técnico asignado no ha registrado el lote y ya pasaron más de N días.
//  2. Reprocesos sin reinspección: la última inspección del lote fue REPROCESO.
//  3. Trabajados sin inspección: lotes abiertos con trabajo de recuperación y sin inspección desde hace N días o más.
// Funciones puras: se usan en bandeja.html y se pueden probar en Node.
(function (root) {
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase().replace(/\s+/g, ' ');
  const dias = (a, b) => (a && b ? Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) : null);
  // Estados en los que el lote ya no necesita nada del taller.
  const CERRADOS = ['Listo', 'Entregado', 'Trasladado', 'Producto importado'];
  // La inspección de calidad empezó el 26/10/2026: el trabajo anterior no se espera inspeccionado.
  const DESDE_INSPECCION = '2026-10-26';
  const DEF = { diasAsignacion: 2, diasSinInspeccion: 3 };
  const AREA_ASIG = { eban: 'Ebanistería', tapi: 'Tapicería' };

  // Severidad por días: alta 10+, media 5–9, baja menos de 5.
  const severidad = (d) => (d >= 10 ? 'alta' : d >= 5 ? 'media' : 'baja');

  function bandeja(lotes, hoy, opciones) {
    const op = { ...DEF, ...(opciones || {}) };

    // Último registro de cada técnico (en cualquier lote).
    const ultimoTec = new Map();
    for (const L of lotes) for (const r of L.regs || []) {
      const k = norm(r.tecnico);
      if (k && (!ultimoTec.has(k) || ultimoTec.get(k) < r.fecha)) ultimoTec.set(k, r.fecha);
    }

    // 1. Asignaciones sin registro, agrupadas por técnico.
    const porTec = new Map();
    let cerradosSinRegistro = 0;
    for (const L of lotes) {
      if (!L.asignacion) continue;
      for (const id of Object.keys(AREA_ASIG)) {
        const C = L.celdas[id];
        if (!C || !C.asignado) continue;
        const k = norm(C.asignado);
        if (C.regs.some((r) => norm(r.tecnico) === k)) continue;
        if (CERRADOS.includes(L.estado)) { cerradosSinRegistro++; continue; }
        const d = dias(L.asignacion, hoy);
        if (d === null || d <= op.diasAsignacion) continue;
        if (!porTec.has(k)) porTec.set(k, { tecnico: C.asignado, area: AREA_ASIG[id], lotes: [] });
        porTec.get(k).lotes.push({
          lote: L.lote, producto: L.producto, asignacion: L.asignacion, dias: d, sev: severidad(d), estado: L.estado,
          piezas: C.piezasAsig, otros: C.tecnicos.filter((t) => norm(t) !== k),
        });
      }
    }
    const asignaciones = [...porTec.values()].map((t) => {
      t.lotes.sort((a, b) => b.dias - a.dias || (a.lote < b.lote ? -1 : 1));
      const ult = ultimoTec.get(norm(t.tecnico)) || null;
      return { ...t, n: t.lotes.length, max: t.lotes[0].dias, ultimo: ult, diasSinRegistrar: ult ? dias(ult, hoy) : null };
    }).sort((a, b) => b.n - a.n || b.max - a.max);

    // 2. Reprocesos sin reinspección.
    const reprocesos = [];
    for (const L of lotes) {
      if (L.estado !== 'Reproceso' || !L.insp) continue;
      const I = L.insp;
      const d = dias(I.fecha, hoy);
      const trabajo = (L.regs || []).filter((r) => r.dt > I.dt && r.area_id !== 'emp');
      const movs = (L.movs || []).filter((m) => m.fecha >= I.fecha);
      const regreso = movs.find((m) => m.mov === '101') || null;
      const envio = movs.filter((m) => m.mov === '161').pop() || null;
      const aProveedor = norm(I.reproceso) === 'PROVEEDOR';
      let situacion, listo = false;
      if (trabajo.length) { listo = true; const u = trabajo[trabajo.length - 1]; situacion = { texto: 'Listo para reinspeccionar', detalle: `Trabajado por ${u.tecnico} el ${u.fecha}`, tecnico: u.tecnico, fecha: u.fecha }; }
      else if (aProveedor && regreso && (!envio || regreso.fecha >= envio.fecha)) { listo = true; situacion = { texto: 'Listo para reinspeccionar', detalle: `Regresó del proveedor el ${regreso.fecha}`, fecha: regreso.fecha }; }
      else if (aProveedor && envio) situacion = { texto: 'En el proveedor', detalle: `Enviado el ${envio.fecha}`, fecha: envio.fecha };
      else if (aProveedor) situacion = { texto: 'Pendiente de enviar al proveedor', detalle: '' };
      else situacion = { texto: 'Sin trabajo registrado desde la inspección', detalle: '' };
      reprocesos.push({
        lote: L.lote, producto: L.producto, area: I.reproceso || '', origen: I.origen || '', inspector: I.inspector || '', fecha: I.fecha,
        obs: I.obs || '', dias: d, sev: severidad(d), listo, situacion, tipo: L.tipo, proveedor: L.proveedor,
      });
    }
    reprocesos.sort((a, b) => (b.listo - a.listo) || b.dias - a.dias);

    // 3. Trabajados sin inspección (lotes abiertos, sin reproceso pendiente).
    const sinInspeccion = { taller: [], venta: [] };
    for (const L of lotes) {
      if (CERRADOS.includes(L.estado) || L.estado === 'Reproceso' || L.estado === 'En proveedor') continue;
      const rec = (L.regs || []).filter((r) => r.area_id && r.area_id !== 'emp');
      if (!rec.length) continue;
      const ult = rec[rec.length - 1];
      if (ult.fecha < DESDE_INSPECCION) continue;
      if ((L.inspecciones || []).some((i) => i.fecha >= ult.fecha)) continue;
      const d = dias(ult.fecha, hoy);
      if (d < op.diasSinInspeccion) continue;
      const areas = [...new Set(rec.map((r) => r.area_id))];
      const tecnicos = [...new Set(rec.map((r) => r.tecnico).filter(Boolean))];
      const item = { lote: L.lote, producto: L.producto, tipo: L.tipo, estado: L.estado, areas, tecnicos, ultimo: ult.fecha, dias: d, sev: severidad(d), picking: L.picking };
      (/^Taller/.test(L.tipo) ? sinInspeccion.taller : sinInspeccion.venta).push(item);
    }
    for (const k of Object.keys(sinInspeccion)) sinInspeccion[k].sort((a, b) => b.dias - a.dias || (a.lote < b.lote ? -1 : 1));

    return {
      opciones: op,
      asignaciones,
      totalAsignaciones: asignaciones.reduce((s, t) => s + t.n, 0),
      cerradosSinRegistro,
      reprocesos,
      reprocesosListos: reprocesos.filter((r) => r.listo).length,
      sinInspeccion,
    };
  }

  const api = { bandeja, severidad, CERRADOS, DESDE_INSPECCION, DEF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Bandeja = api;
})(typeof window !== 'undefined' ? window : globalThis);
