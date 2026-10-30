# Dashboard de seguimiento taller

Cumplimiento de piezas por técnico y área del taller de reacondicionamiento.

**Enlaces**
- Productividad (para compartir): https://itsjmpg028.github.io/juan-pena/
- Seguimiento de lotes (para compartir): https://itsjmpg028.github.io/juan-pena/seguimiento.html
- Panel de administrador (los dos en pestañas): https://itsjmpg028.github.io/juan-pena/admin.html — `#seguimiento` abre directo esa pestaña. No tiene contraseña: cualquiera con el enlace lo ve.

Cada tablero es independiente (sin enlaces al otro); admin.html los muestra dentro de pestañas con iframes.

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
- Determinación (hoja *Determinación*, solo lotes del taller 2000): TALLER → "Taller plataforma", PROVEEDOR → "Taller proveedor", PRODUCTO IMPORTADO → "Importado". Lotes del taller que no están en la hoja: "Taller sin determinación". Todo lote de Determinación se sigue aunque no tenga registros; si es de proveedor y no tiene registros ni inspección, su estado es "En proveedor".
- Picking (FECHA DE PICKING): si el lote no está listo ni ha salido muestra "Vencido · hace N d", "Vence hoy" o "Vence en 1–2 d"; si ya está listo, regresó del proveedor (101) o salió, la fecha y cómo (p. ej. "inspección 28/10" o "regresó de proveedor 24/10"). Solo picking desde el 26/10/2026 (CORTE_ALERTAS). Filtro y contadores de Vencidos / Vencen hoy / Próximos; en Excel "Aviso de picking" y "Días para picking". Sin vista de incumplimientos (desactivada 28/10).
- Indicadores en un panel compacto por grupos: En proceso, Cerrados, Picking y Tiempos promedio; cada contador filtra la tabla.
- Movimientos (hoja *Traslados*, copia por fórmula de Lote, fecha, centro y clase de movimiento de *Salidas 939*), desde el ingreso del lote:
  - 161 = envío a proveedor: estado "En proveedor · desde dd/mm" hasta que haya un registro de trabajo posterior. Lote con determinación PROVEEDOR sin 161: "Sin enviar a proveedor" Si ya tiene trabajo registrado en el taller, su tipo cambia a "Taller plataforma" (marcado con * y explicado al pasar el cursor).
  - 101 = regreso del proveedor: si no hay trabajo posterior, estado "Regresó de proveedor" (fecha y días que estuvo allá). La inspección de Paul o un registro de trabajo después del envío también cuentan como que el producto volvió.
  - 601 = entrega al cliente (taller): estado "Entregado" con la fecha.
  - 939 = traslado (venta): estado "Trasladado" con la fecha.
- Última columna "Listo → salida": días desde que el lote quedó listo (inspección APROBADO; si no hay, primer empaque) hasta la primera salida 601 o 939. Si sigue en la plataforma, se cuenta hasta hoy (en cursiva). Tarjeta "Promedio listo → salida".
- Filtro Estado: Listos (aprobados por calidad), Listos para picking (aprobados o empacados), No listos y cada estado. Los lotes con picking pendiente se muestran aunque no tengan movimiento reciente, y los vencidos o que vencen hoy van primero.
- Código del producto: la hoja *Ingresos* trae también *Material* (columna I de Inventario). Se ve al pasar el cursor sobre el lote, en el encabezado del recorrido desplegado y en el Excel ("Código material").
- Al pasar el cursor sobre el lote se ve la PIEZA, la determinación y la fecha de picking.
- Botón **Descargar Excel**: exporta a .xlsx todos los lotes que cumplen los filtros actuales (no solo los visibles), en el orden de la tabla. Hoja *Lotes* (44 columnas, fechas reales de Excel, autofiltro) y hoja *Filtros* (filtros aplicados, fecha de generación y notas). Usa SheetJS 0.18.5 desde cdnjs, cargado al hacer clic.
- Filtro "Último movimiento": cuenta la fecha de ingreso, la asignación, los registros, las inspecciones y las salidas (161/601/939).
- Orden de columnas (29/10): Lote · Tipo · Fecha de ingreso · Fecha de picking · Estado · Asignación · áreas · Inspección · días. El Excel sigue el mismo orden.
- Lotes sin intervención del taller (sin asignación ni registros) que están o estuvieron con el proveedor: las 5 columnas de área se reemplazan por una sola franja: "En el proveedor" (enviado dd/mm · N días allá), "Reparado por el proveedor" (enviado · aprobado · salida), "Proveedor · reproceso" o "Pendiente de envío a proveedor". En Excel: columna "Trabajado por".
- Filtro **Fechas**: se elige la fecha (último movimiento, ingreso, picking, asignación, inspección, salida 601/939 o envío a proveedor 161) y el periodo (últimos 7/15/30/60/90 días, todo, o rango personalizado Desde–Hasta).
- Filtro **Técnicos** de selección múltiple, con búsqueda y botones "Seleccionar todos" / "Quitar todos"; muestra cuántos lotes tiene cada técnico.
- Proveedor (columna *Proveedor* de la hoja *Determinación*): se ve al pasar el cursor sobre el lote, en la franja de proveedor, en el recorrido desplegado y en el Excel; filtro Proveedor (todos, con/sin proveedor o uno en particular); el buscador también encuentra por proveedor y código.
