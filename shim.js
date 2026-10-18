// Fuentes de datos: enlaces CSV de "Publicar en la web" del libro APP JAMAR.
window.CSV_URLS = {
  registros: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRlQhy6LzGfbp4m05VwMLxzbL-0696oM7sXXApF_HbIlK6ZiHY8D1tb5LjWjBaoeg26kzYJUw6AQGPw/pub?single=true&output=csv&gid=227315461',
  tecnicos: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRlQhy6LzGfbp4m05VwMLxzbL-0696oM7sXXApF_HbIlK6ZiHY8D1tb5LjWjBaoeg26kzYJUw6AQGPw/pub?single=true&output=csv&gid=1892076150',
  calendario: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRlQhy6LzGfbp4m05VwMLxzbL-0696oM7sXXApF_HbIlK6ZiHY8D1tb5LjWjBaoeg26kzYJUw6AQGPw/pub?single=true&output=csv&gid=906264716',
};
window.REFRESCO_MIN = 5;

// Pequeño motor que reemplaza al del tablero de Claude: carga los CSV, aplica las
// conversiones y cálculos de calcs.js, guarda los filtros y redibuja.
(function () {
  const loaders = {}, calcs = {}, store = {}, listeners = [];
  const DEFAULTS = { mes: null, area: null, tecnico: null, tipo: 'Todos', excluidos: [] };
  let params = { ...DEFAULTS };
  try { const saved = JSON.parse(localStorage.getItem('tj-filtros') || 'null'); if (saved) params = { ...DEFAULTS, ...saved }; } catch (e) { /* sin almacenamiento */ }
  delete params.mes; delete params.tecnico; params = { ...DEFAULTS, ...params };
  // Se recuerdan área, tipo y técnicos quitados; el mes siempre abre en el actual.
  const save = () => { try { const { area, tipo, excluidos } = params; localStorage.setItem('tj-filtros', JSON.stringify({ area, tipo, excluidos })); } catch (e) { /* sin almacenamiento */ } };
  let scheduled = false;
  const fire = () => {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; listeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } }); }, 0);
  };

  window.dash = {
    colors: ['#1F2937', '#D2132C', '#64748B', '#0F766E', '#B45309', '#7C3AED', '#0369A1', '#9F1239'],
    loader(id, o) { loaders[id] = o; },
    calc(id, o) { calcs[id] = o; },
    data(id) { return store[id] || { status: 'loading', data: [] }; },
    onData(fn) { listeners.push(fn); fn(); },
    params() { return { ...params }; },
    setParams(p) { params = { ...params, ...p }; save(); fire(); },
    resetParams() { params = { ...DEFAULTS }; save(); fire(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ } },
    refresh() { cargar(); },
  };

  function runCalcs() {
    for (const [id, c] of Object.entries(calcs)) {
      const inputs = c.inputs.map((i) => store[i]);
      if (inputs.some((x) => !x || x.status !== 'ok')) {
        if (inputs.some((x) => x && x.status === 'error')) store[id] = { status: 'error', data: [], message: 'Falta una fuente' };
        continue;
      }
      try { store[id] = { status: 'ok', data: c.fn(...inputs.map((x) => x.data)) }; }
      catch (err) { console.error(err); store[id] = { status: 'error', data: [], message: String(err) }; }
    }
  }

  let ultima = null;
  async function cargar() {
    const ids = Object.keys(window.CSV_URLS);
    for (const id of ids) if (store[id]) store[id].refreshing = true;
    await Promise.all(ids.map(async (id) => {
      try {
        const url = window.CSV_URLS[id] + (window.CSV_URLS[id].includes('?') ? '&' : '?') + '_t=' + Date.now();
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (/^\s*</.test(text)) throw new Error('El enlace no devolvió un CSV. Revisa que la hoja esté publicada como .csv');
        const values = d3.csvParseRows(text);
        const out = loaders[id].fn({ answer: { values } });
        store[id] = { status: 'ok', data: out.rows || out, columns: out.columns };
      } catch (err) {
        console.error(id, err);
        if (!store[id] || store[id].status !== 'ok') store[id] = { status: 'error', data: [], message: String(err) };
        else store[id].refreshing = false;
      }
    }));
    runCalcs();
    if (Object.values(store).some((s) => s.status === 'ok')) ultima = new Date();
    const el = document.getElementById('tj-actualizado');
    if (el) {
      const err = ids.filter((id) => store[id].status === 'error');
      el.textContent = err.length
        ? `No se pudieron cargar: ${err.join(', ')}. Se reintenta en ${window.REFRESCO_MIN} min.`
        : `Datos del ${ultima.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })} a las ${ultima.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} · se actualiza cada ${window.REFRESCO_MIN} min`;
    }
    fire();
  }
  window.addEventListener('resize', fire);
  const iniciar = () => {
    if (iniciar.hecho) return; iniciar.hecho = true;
    cargar();
    setInterval(cargar, window.REFRESCO_MIN * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) cargar(); });
    const b = document.getElementById('tj-refrescar');
    if (b) b.addEventListener('click', cargar);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
  window.addEventListener('load', iniciar);
})();
