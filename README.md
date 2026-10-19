# Dashboard de seguimiento taller

Cumplimiento de piezas por técnico y área del taller de reacondicionamiento.

**Ver el tablero:** https://itsjmpg028.github.io/juan-pena/

- Lee en vivo las hojas *Registro de PrOD*, *Tecnico* y *Calendario* del libro APP JAMAR, publicadas en la web como CSV (enlaces en `shim.js`).
- Se recarga sola cada 5 minutos.
- Selector **Piezas | Lotes**: mide contra Meta_Diaria_Piezas o Meta_Diaria_Lotes (hoja Tecnico).
- Meta a la fecha = meta diaria × días hábiles transcurridos del mes (incluido hoy). Estado: Cumple ≥ 100 %, Cerca 85–99 %, Bajo < 85 %.
- Regla de lotes: un lote (6–8 dígitos) cuenta una sola vez por área y tipo de servicio; lo gana el primer registro. Los códigos 101 y 102 se pueden repetir (cada registro suma 1). Otros valores (CP, x, 5s…) suman 1 y salen como "Lote por revisar". Un lote escrito con "2026" pegado al final se lee sin ese "2026".

Archivos: `index.html` (página), `calcs.js` (conversión de datos y cálculos), `shim.js` (carga de datos y filtros), `tokens.css` (colores y tipografía).
