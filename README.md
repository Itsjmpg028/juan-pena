# Dashboard de seguimiento taller

Cumplimiento de piezas por técnico y área del taller de reacondicionamiento.

**Ver el tablero:** https://itsjmpg028.github.io/juan-pena/

- Lee en vivo las hojas *Registro de PrOD*, *Tecnico* y *Calendario* del libro APP JAMAR, publicadas en la web como CSV (enlaces en `shim.js`).
- Se recarga sola cada 5 minutos.
- Selector **Piezas | Lotes**: mide contra Meta_Diaria_Piezas o Meta_Diaria_Lotes (hoja Tecnico).
- Meta a la fecha = meta diaria × días hábiles transcurridos del mes (incluido hoy). Estado: Cumple ≥ 100 %, Cerca 85–99 %, Bajo < 85 %.
- Regla de lotes: un lote (6–8 dígitos) cuenta una sola vez por área y tipo de servicio; lo gana el primer registro. Los códigos 101 y 102 se pueden repetir (cada registro suma 1). Otros valores (CP, x, 5s…) suman 1 y salen como "Lote por revisar". Un lote escrito con "2026" pegado al final se lee sin ese "2026".

Archivos: `index.html` (página), `calcs.js` (conversión de datos y cálculos), `shim.js` (carga de datos y filtros), `tokens.css` (colores y tipografía).

## Seguimiento de lotes

**Ver:** https://itsjmpg028.github.io/juan-pena/seguimiento.html

Una fila por lote con su recorrido: Fecha de ingreso (Inventario → Fe.contabilización) · Asignación · Ebanistería · Acabados · Costura · Tapicería · Empaque · Inspección · Estado · días Ingreso → asignación, Asignación → listo y Total.

- Lee las hojas *Registro de PrOD*, *Asignación*, *Inspección Calidad* e *Ingresos* publicadas como CSV. *Ingresos* es una copia automática (fórmula FILTER en A1) de 4 columnas de *Inventario* — Lote, Fe.contabilización, Centro, Texto breve de material —, para no publicar clientes ni valores.
- Lotes incluidos: todo lote asignado y todo lote con registros de producción (6–8 dígitos; 101/102 y valores raros no se siguen).
- Tipo por centro: 2000, 2001, 2006 = Taller; 2500, 2503, 2506, 2508 = Venta. El ORIGEN que elige el inspector se muestra aparte.
- Áreas: Acabados incluye POLICHE; Empaque = TIPO DE SERVICIO "EMPAQUE" (lo registre quien lo registre).
- Colores: rojo = asignado sin registrar; azul = registrado sin inspección (técnico y última fecha); verde = lote aprobado por calidad; naranja = lote inspeccionado pero el técnico asignado nunca registró; gris = el área no participó. Lote aprobado = fila en verde.
- Estados: Por iniciar · En proceso · Por inspeccionar (áreas asignadas completas o empacado) · Reproceso · Listo (inspección más reciente APROBADO).
- Fecha de ingreso: la entrada de Inventario más reciente que sea anterior al inicio del trabajo.
