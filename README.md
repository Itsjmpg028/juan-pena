# Dashboard de seguimiento taller

Cumplimiento de piezas por técnico y área del taller de reacondicionamiento.

**Ver el tablero:** https://itsjmpg028.github.io/juan-pena/

- Lee en vivo las hojas *Registro de PrOD*, *Tecnico* y *Calendario* del libro APP JAMAR, publicadas en la web como CSV (enlaces en `shim.js`).
- Se recarga sola cada 5 minutos.
- Meta a la fecha = meta diaria × días hábiles transcurridos del mes (incluido hoy). Estado: Cumple ≥ 100 %, Cerca 85–99 %, Bajo < 85 %.

Archivos: `index.html` (página), `calcs.js` (conversión de datos y cálculos), `shim.js` (carga de datos y filtros), `tokens.css` (colores y tipografía).
