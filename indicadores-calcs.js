// Indicadores del taller (vista de administrador). Funciones puras sobre los lotes que arma seguimiento-calcs.js.
(function (root) {
  // Metas iniciales (04/11/2026, punto de partida acordado con el usuario). dir: 'max' = más es mejor, 'min' = menos es mejor.
  const METAS = {
    picking: { valor: 0.9, dir: 'max', texto: '≥ 90 %' },
    ciclo: { valor: 10, dir: 'min', texto: '≤ 10 d' },
    salida: { valor: 3, dir: 'min', texto: '≤ 3 d' },
    calidad: { valor: 0.95, dir: 'max', texto: '≥ 95 %' },
  };
  const DIAS_ENVEJECIDO = 15; // lote abierto con más de estos días desde su ingreso
  const ACTIVIDAD_DIAS = 60; // solo se cuentan abiertos con movimiento en los últimos N días

  const dias = (a, b) => (a && b ? Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000) : null);
  const sumar = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const enRango = (f, desde, hasta) => !!f && f >= desde && f <= hasta;
  const mediana = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const promedio = (a) => { const b = a.filter((x) => x != null); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
  const CERRADOS = ['Listo', 'Entregado', 'Trasladado'];
  // Lunes de la semana de una fecha ISO.
  const lunes = (iso) => { const d = new Date(iso + 'T00:00:00Z'); const w = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - w); return d.toISOString().slice(0, 10); };

  // Estado del semáforo frente a la meta: 'ok', 'cerca' (a menos de 10 % de la meta) o 'mal'.
  function semaforo(clave, v) {
    const m = METAS[clave];
    if (!m || v == null) return 'nd';
    if (m.dir === 'max') return v >= m.valor ? 'ok' : v >= m.valor * 0.9 ? 'cerca' : 'mal';
    return v <= m.valor ? 'ok' : v <= m.valor * 1.1 ? 'cerca' : 'mal';
  }

  function resumenPeriodo(lotes, desde, hasta, hoy) {
    const corte = hasta < hoy ? hasta : hoy;
    // 1. Cumplimiento de picking: lotes con fecha de picking en el periodo (y ya cumplida); a tiempo = listo, regresado o
    //    salido a más tardar ese día.
    const pk = lotes.filter((l) => l.picking && enRango(l.picking, desde, corte));
    const pkOk = pk.filter((l) => l.cierre && l.cierre.fecha <= l.picking);
    const pkTarde = pk.filter((l) => l.cierre && l.cierre.fecha > l.picking);
    const pkPend = pk.filter((l) => !l.cierre);
    // 2. Tiempo de ciclo: lotes que quedaron listos en el periodo (ingreso → listo).
    const listos = lotes.filter((l) => l.listo && enRango(l.listo.fecha, desde, hasta));
    const ciclos = listos.map((l) => dias(l.entrada || l.inicio, l.listo.fecha)).filter((x) => x != null && x >= 0);
    // 3. Listo → salida: lotes que salieron (601/939) en el periodo y tenían fecha de listo.
    const salidas = lotes.filter((l) => l.traslado && enRango(l.traslado, desde, hasta) && l.d_listo_salida != null);
    // 4. Calidad a la primera: primera inspección de cada lote dentro del periodo.
    const primeras = lotes.map((l) => (l.inspecciones && l.inspecciones[0]) || null).filter((i) => i && enRango(i.fecha, desde, hasta));
    const aprob = primeras.filter((i) => i.resultado === 'APROBADO');
    // 6. Salida semanal: lotes que quedaron listos, por semana (lunes).
    const semanas = new Map();
    for (let w = lunes(desde); w <= hasta; w = sumar(w, 7)) semanas.set(w, 0);
    for (const l of listos) { const w = lunes(l.listo.fecha); if (semanas.has(w)) semanas.set(w, semanas.get(w) + 1); }
    const nSem = Math.max(1, (dias(desde, hasta) + 1) / 7);
    return {
      picking: { valor: pk.length ? pkOk.length / pk.length : null, n: pk.length, ok: pkOk.length, tarde: pkTarde.length, pendientes: pkPend.length },
      ciclo: { valor: mediana(ciclos), promedio: promedio(ciclos), n: ciclos.length },
      salida: { valor: mediana(salidas.map((l) => l.d_listo_salida)), promedio: promedio(salidas.map((l) => l.d_listo_salida)), n: salidas.length },
      calidad: { valor: primeras.length ? aprob.length / primeras.length : null, n: primeras.length, ok: aprob.length },
      semanal: { valor: listos.length / nSem, total: listos.length, semanas: [...semanas.entries()] },
    };
  }

  // 5. Lotes envejecidos (foto de hoy): abiertos, con movimiento reciente y más de 15 días desde su ingreso.
  function envejecidos(lotes, hoy) {
    const desdeAct = sumar(hoy, -ACTIVIDAD_DIAS);
    const abiertos = lotes.filter((l) => !CERRADOS.includes(l.estado) && l.ultimo_mov && l.ultimo_mov >= desdeAct);
    const edad = (l) => dias(l.entrada || l.inicio, hoy);
    const viejos = abiertos.filter((l) => (edad(l) ?? 0) > DIAS_ENVEJECIDO);
    const por = (f) => viejos.filter(f).length;
    const porEstado = {};
    for (const l of viejos) porEstado[l.estado] = (porEstado[l.estado] || 0) + 1;
    return { valor: viejos.length, abiertos: abiertos.length, d16a30: por((l) => edad(l) <= 30), mas30: por((l) => edad(l) > 30), porEstado, lotes: viejos };
  }

  // Ranking de proveedores: lotes enviados (161) en el periodo.
  function proveedores(lotes, desde, hasta, hoy) {
    const env = lotes.filter((l) => l.envio_prov && enRango(l.envio_prov, desde, hasta));
    const grupos = new Map();
    for (const l of env) { const p = l.proveedor || '(sin dato)'; if (!grupos.has(p)) grupos.set(p, []); grupos.get(p).push(l); }
    const filas = [...grupos.entries()].map(([proveedor, ls]) => {
      const volvieron = ls.filter((l) => l.vuelta_prov);
      const pend = ls.filter((l) => !l.vuelta_prov);
      const conPicking = ls.filter((l) => l.picking && (l.vuelta_prov || l.picking <= hoy));
      const aTiempo = conPicking.filter((l) => l.vuelta_prov && l.vuelta_prov <= l.picking);
      return {
        proveedor,
        enviados: ls.length,
        regresaron: volvieron.length,
        diasProm: promedio(volvieron.map((l) => l.dias_prov)),
        pendientes: pend.length,
        maxPendiente: pend.length ? Math.max(...pend.map((l) => l.dias_prov || 0)) : null,
        pctPicking: conPicking.length ? aTiempo.length / conPicking.length : null,
        nPicking: conPicking.length,
        lotes: ls,
      };
    });
    filas.sort((a, b) => b.enviados - a.enviados || a.proveedor.localeCompare(b.proveedor, 'es'));
    const total = {
      enviados: env.length,
      regresaron: env.filter((l) => l.vuelta_prov).length,
      diasProm: promedio(env.filter((l) => l.vuelta_prov).map((l) => l.dias_prov)),
      pendientes: env.filter((l) => !l.vuelta_prov).length,
    };
    return { filas, total };
  }

  // Bloque 2 · Flujo semanal: por semana (lunes), lotes en seguimiento que entraron (fecha de ingreso, o inicio si no
  // hay ingreso), quedaron listos y salieron (601/939). Neto = entraron − salieron.
  function flujo(lotes, desde, hasta) {
    const sem = new Map();
    for (let w = lunes(desde); w <= hasta; w = sumar(w, 7)) sem.set(w, { semana: w, entraron: 0, listos: 0, salieron: 0, parcial: w < desde || sumar(w, 6) > hasta });
    const sumarA = (f, k) => { if (!enRango(f, desde, hasta)) return; const s = sem.get(lunes(f)); if (s) s[k] += 1; };
    for (const l of lotes) {
      sumarA(l.entrada || l.inicio, 'entraron');
      if (l.listo) sumarA(l.listo.fecha, 'listos');
      sumarA(l.traslado, 'salieron');
    }
    const semanas = [...sem.values()];
    const tot = semanas.reduce((a, s) => ({ entraron: a.entraron + s.entraron, listos: a.listos + s.listos, salieron: a.salieron + s.salieron }), { entraron: 0, listos: 0, salieron: 0 });
    return { semanas, total: { ...tot, neto: tot.entraron - tot.salieron } };
  }

  function calcular(lotes, desde, hasta, hoy) {
    const largo = dias(desde, hasta) + 1;
    const antHasta = sumar(desde, -1), antDesde = sumar(desde, -largo);
    return {
      actual: resumenPeriodo(lotes, desde, hasta, hoy),
      anterior: resumenPeriodo(lotes, antDesde, antHasta, hoy),
      anteriorRango: [antDesde, antHasta],
      envejecidos: envejecidos(lotes, hoy),
      proveedores: proveedores(lotes, desde, hasta, hoy),
      flujo: flujo(lotes, desde, hasta),
    };
  }

  const api = { calcular, semaforo, METAS, DIAS_ENVEJECIDO, ACTIVIDAD_DIAS, sumar, dias, lunes };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Indicadores = api;
})(typeof window !== 'undefined' ? window : globalThis);
