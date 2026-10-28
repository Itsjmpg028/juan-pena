// Loaders: turn Google Sheets get_values answers into rows, and the calculations behind every figure.
(function () {
  const valuesOf = (answer) => {
    const a = typeof answer === 'string' ? JSON.parse(answer) : answer;
    if (!a || !Array.isArray(a.values)) {
      throw new Error('Google Sheets no devolvió valores para este rango. Claves recibidas: ' + Object.keys(a || {}).join(', '));
    }
    return a.values;
  };
  // "01/07/2026" or "1/07/2026" -> "2026-07-01"
  const isoDate = (s) => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '').trim());
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  };
  // Find each column by its header name (accents, spaces and case ignored), so reordering columns in the sheet
  // does not break the dashboard. Falls back to the usual position if a header is not found.
  const clave = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9#]/gi, '').toLowerCase();
  const columnas = (header, mapa) => {
    const h = header.map(clave);
    const out = {};
    for (const [campo, [nombres, defecto]] of Object.entries(mapa)) {
      const i = h.findIndex((x) => nombres.map(clave).includes(x));
      out[campo] = i >= 0 ? i : defecto;
    }
    return out;
  };
  const num = (s) => {
    const t = String(s ?? '').trim().replace(/\./g, '').replace(',', '.');
    return t === '' || isNaN(Number(t)) ? null : Number(t);
  };

  dash.loader('registros', {
    description: 'Las filas de la hoja Registro de PrOD como tabla: fecha pasada a AAAA-MM-DD y # DE PIEZAS a número.',
    fn: ({ answer }) => {
      if (Array.isArray(answer)) return answer; // saved copy: already rows
      const [header = [], ...rows] = valuesOf(answer);
      const k = columnas(header, {
        id: [['ID_REG'], 0], fecha: [['FECHA'], 1], fecha_hora: [['FECHA HORA'], 2], tecnico: [['TÉCNICO', 'TECNICO'], 3],
        area: [['ÁREA', 'AREA'], 4], lote: [['Lote'], 5], producto: [['PRODUCTO'], 6], pieza: [['PIEZA O MODULO'], 7],
        tipo: [['TIPO DE SERVICIO'], 8], piezas: [['# DE PIEZAS', 'PIEZAS'], 9],
      });
      return {
        columns: ['fila', 'id', 'fecha', 'fecha_hora', 'tecnico', 'area', 'lote', 'producto', 'pieza', 'tipo', 'piezas'],
        rows: rows
          .map((r, i) => [i + 2, r])
          .filter(([, r]) => r.some((c) => String(c).trim() !== ''))
          .map(([fila, r]) => ({
            fila,
            id: r[k.id] ?? '',
            fecha: isoDate(r[k.fecha]),
            fecha_hora: r[k.fecha_hora] ?? '',
            tecnico: String(r[k.tecnico] ?? '').trim(),
            area: String(r[k.area] ?? '').trim(),
            lote: r[k.lote] ?? '',
            producto: r[k.producto] ?? '',
            pieza: r[k.pieza] ?? '',
            tipo: String(r[k.tipo] ?? '').trim(),
            piezas: num(r[k.piezas]),
          })),
      };
    },
  });

  dash.loader('tecnicos', {
    description: 'Las filas de la hoja Tecnico como tabla: metas diarias (piezas y lotes) a número y Activo (VERDADERO/FALSO) a sí/no.',
    fn: ({ answer }) => {
      if (Array.isArray(answer)) return answer; // saved copy: already rows
      const [header = [], ...rows] = valuesOf(answer);
      const k = columnas(header, {
        tecnico: [['TECNICOS', 'TECNICO'], 0], area: [['ÁREA', 'AREA'], 1], meta_diaria: [['Meta_Diaria_Piezas'], 2],
        meta_lotes: [['Meta_Diaria_Lotes'], 3], activo: [['Activo'], 4],
      });
      return {
        columns: ['tecnico', 'area', 'meta_diaria', 'activo', 'meta_lotes'],
        rows: rows
          .filter((r) => String(r[k.tecnico] ?? '').trim() !== '')
          .map((r) => ({
            tecnico: String(r[k.tecnico]).trim(),
            area: String(r[k.area] ?? '').trim(),
            meta_diaria: num(r[k.meta_diaria]),
            activo: /^(verdadero|true|s[ií]|y|yes)$/i.test(String(r[k.activo] ?? '').trim()),
            meta_lotes: num(r[k.meta_lotes]),
          })),
      };
    },
  });

  dash.loader('calendario', {
    description: 'Las filas de la hoja Calendario como tabla: fecha pasada a AAAA-MM-DD y Es_Habil a sí/no.',
    fn: ({ answer }) => {
      if (Array.isArray(answer)) return answer; // saved copy: already rows
      const [header = [], ...rows] = valuesOf(answer);
      const k = columnas(header, {
        fecha: [['Fecha'], 0], dia_semana: [['Dia_Semana'], 3], festivo: [['Nombre_Festivo'], 6], habil: [['Es_Habil'], 7],
      });
      return {
        columns: ['fecha', 'dia_semana', 'festivo', 'habil'],
        rows: rows
          .filter((r) => isoDate(r[k.fecha]))
          .map((r) => ({
            fecha: isoDate(r[k.fecha]),
            dia_semana: r[k.dia_semana] ?? '',
            festivo: r[k.festivo] ?? '',
            habil: /^(verdadero|true)$/i.test(String(r[k.habil] ?? '').trim()),
          })),
      };
    },
  });

  // Lote rule: a real lote (6–8 digits) counts once per área and tipo de servicio; the first registration gets it.
  // Codes 101 (zona de dudas) and 102 (forros) may repeat: each registro counts 1. Any other value that is not a
  // 6–8 digit lote (CP, x, 5s…) also counts 1 and is marked "Lote por revisar".
  // A lote typed with the year stuck at the end (17340252026) is read without the "2026".
  const loteNorm = (l) => { let s = String(l ?? '').trim(); if (/^\d{6,8}2026$/.test(s)) s = s.slice(0, -4); return s; };
  dash.calc('registros_lotes', {
    title: 'Registros contados como lote',
    description: 'Cada registro marcado: Cuenta (primer registro del lote en esa área y tipo), Repetido (no suma), Repetible 101/102 (suma siempre) o Lote por revisar (suma 1).',
    inputs: ['registros'],
    fn: (registros) => {
      const vistos = new Map();
      const orden = registros.filter((r) => r.fecha && r.tecnico).slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.fila - b.fila));
      const out = new Map();
      for (const r of orden) {
        const l = loteNorm(r.lote);
        if (l === '101' || l === '102') { out.set(r.fila, { estado_lote: 'Repetible (101/102)', cuenta_lote: 1, lote_leido: l }); continue; }
        if (!/^\d{6,8}$/.test(l)) { out.set(r.fila, { estado_lote: 'Lote por revisar', cuenta_lote: 1, lote_leido: l }); continue; }
        const k = `${l}|${r.area}|${r.tipo}`;
        if (vistos.has(k)) { out.set(r.fila, { estado_lote: 'Repetido', cuenta_lote: 0, lote_leido: l, primera_fila: vistos.get(k) }); continue; }
        vistos.set(k, r.fila);
        out.set(r.fila, { estado_lote: 'Cuenta', cuenta_lote: 1, lote_leido: l });
      }
      return registros.map((r) => ({ ...r, ...(out.get(r.fila) || { estado_lote: 'Sin fecha', cuenta_lote: 0, lote_leido: loteNorm(r.lote) }) }));
    },
  });

  function resumen(registros, tecnicos, calendario, valor, metaDe) {
    const d = new Date();
    const hoy = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const mesHoy = hoy.slice(0, 7);
    const habiles = {};
    for (const c of calendario) {
      if (!c.habil) continue;
      const h = (habiles[c.fecha.slice(0, 7)] ||= { total: 0, aFecha: 0 });
      h.total += 1;
      if (c.fecha <= hoy) h.aFecha += 1;
    }
    const info = new Map(tecnicos.map((t) => [t.tecnico, t]));
    const validos = registros.filter((r) => r.fecha && r.tecnico);
    const meses = new Set(validos.map((r) => r.fecha.slice(0, 7)));
    meses.add(mesHoy);
    const tipos = ['Todos', ...new Set(validos.map((r) => r.tipo).filter(Boolean))];
    const acc = new Map();
    for (const r of validos) {
      const v = valor(r);
      for (const tipo of ['Todos', r.tipo]) {
        const k = `${r.fecha.slice(0, 7)}|${r.tecnico}|${tipo}`;
        const a = acc.get(k) || { piezas: 0, dias: new Set(), registros: 0 };
        a.piezas += v;
        if (v > 0) a.dias.add(r.fecha);
        a.registros += 1;
        acc.set(k, a);
      }
    }
    const r2 = (x, n) => (x == null ? null : Math.round(x * 10 ** n) / 10 ** n);
    const out = [];
    for (const mes of [...meses].sort()) {
      if (mes > mesHoy) continue;
      const h = habiles[mes] || { total: 0, aFecha: 0 };
      const nombres = new Set([
        ...tecnicos.filter((t) => t.activo).map((t) => t.tecnico),
        ...validos.filter((r) => r.fecha.startsWith(mes)).map((r) => r.tecnico),
      ]);
      for (const tecnico of nombres) {
        const t = info.get(tecnico);
        const meta = t ? metaDe(t) : null;
        for (const tipo of tipos) {
          const a = acc.get(`${mes}|${tecnico}|${tipo}`) || { piezas: 0, dias: new Set(), registros: 0 };
          const metaFecha = meta == null ? null : r2(meta * h.aFecha, 1);
          const metaMes = meta == null ? null : r2(meta * h.total, 1);
          const cumpl = metaFecha ? a.piezas / metaFecha : null;
          out.push({
            mes, tecnico, tipo,
            area: t ? t.area : 'SIN ÁREA',
            activo: t ? t.activo : false,
            meta_diaria: meta,
            dias_habiles_mes: h.total,
            dias_habiles_a_fecha: h.aFecha,
            piezas: a.piezas,
            registros: a.registros,
            dias_con_registro: a.dias.size,
            meta_a_fecha: metaFecha,
            meta_mes: metaMes,
            cumplimiento_a_fecha: r2(cumpl, 4),
            avance_mes: metaMes ? r2(a.piezas / metaMes, 4) : null,
            promedio_habil: h.aFecha ? r2(a.piezas / h.aFecha, 1) : null,
            promedio_diario: a.dias.size ? r2(a.piezas / a.dias.size, 1) : 0,
            proyeccion_cierre: h.aFecha ? Math.round((a.piezas / h.aFecha) * h.total) : null,
            estado: cumpl == null ? 'Sin meta' : cumpl >= 1 ? 'Cumple' : cumpl >= 0.85 ? 'Cerca' : 'Bajo',
          });
        }
      }
    }
    return out;
  }

  dash.calc('resumen_tecnico', {
    title: 'Cumplimiento por técnico (piezas)',
    description: 'Por mes, técnico y tipo de servicio: piezas registradas frente a la meta diaria de piezas × días hábiles.',
    inputs: ['registros', 'tecnicos', 'calendario'],
    fn: (registros, tecnicos, calendario) => resumen(registros, tecnicos, calendario, (r) => r.piezas || 0, (t) => t.meta_diaria),
  });

  dash.calc('resumen_lotes', {
    title: 'Cumplimiento por técnico (lotes)',
    description: 'Por mes, técnico y tipo de servicio: lotes contados (regla de un lote por área y tipo) frente a la meta diaria de lotes × días hábiles.',
    inputs: ['registros_lotes', 'tecnicos', 'calendario'],
    fn: (registros_lotes, tecnicos, calendario) => resumen(registros_lotes, tecnicos, calendario, (r) => r.cuenta_lote || 0, (t) => t.meta_lotes),
  });

})();
