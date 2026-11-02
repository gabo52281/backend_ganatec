# GANATEC — Auditoría técnica previa al módulo de reportes

**Fecha de revisión:** 2026-11-01  
**Alcance:** inspección estática del código público de `mejiap1234/backend_ganatec` (main, SHA `1607dd1d9b75aa29eebe053895f5415de3742441`) y `mejiap1234/frontend_ganatec` (main, SHA `b3ca651fad00855ae1ba1735ae64f5f9b6edc0e7`).

**Estado:** auditoría de código; no constituye certificación de los datos de Neon ni pruebas de integración. No se tuvo acceso a esquemas SQL/migraciones, datos reales, credenciales ni ejecución de consultas contra PostgreSQL.

## Conclusión ejecutiva

**Hay fuentes de datos suficientes en el código para diseñar cinco reportes importantes**, pero antes de confiar en los totales hay que resolver inconsistencias de producción de leche, paginación, agregaciones y validación de periodos. No existe aún un módulo propio de cinco reportes en las rutas o páginas examinadas. Las consultas de operación actuales no deben reutilizarse indiscriminadamente para reportes, porque pueden devolver solo una parte de los registros y cargar demasiados datos en el navegador.

## Hallazgos priorizados

### P0 — Antes de publicar totales financieros/productivos
1. **La leche puede presentar resúmenes distintos según la pantalla.** En `src/controllers/leche.controller.js`, `obtenerResumenProduccionFinca` une producción detallada con rápida mediante `UNION ALL` sin excluir fechas que ya cuentan con la otra fuente. El calendario y resumen anual en `src/controllers/produccionLeche.controller.js` sí excluyen la producción detallada cuando existe la rápida para esa fecha. Aunque las altas intentan impedir solapamientos, diferencias históricas, correcciones o concurrencia pueden dar cifras contradictorias. **Regla propuesta:** una sola definición SQL de producción por fecha y finca, con prioridad explícita y aviso de conflicto, compartida por dashboard, IA y reportes. Validar si efectivamente hay fechas solapadas antes de alterar cifras.
2. **No confundir resultado financiero con utilidad neta.** `resumenFinanciero` suma ingresos y gastos registrados y calcula balance; no incorpora necesariamente depreciación, valorización del inventario ni todas las obligaciones. Etiquetarlo como **balance de movimientos registrados**, no «ganancia neta».
3. **Roles y finca:** todos los reportes deben usar el `finca_id` del token verificado, nunca uno proporcionado por el navegador. Reportes financieros: solo rol `administrador`, coherente con `finanzas.routes.js`. No enviar importes financieros a trabajadores mediante reportes «generales».

### P1 — Integridad, cobertura y paginación
4. **Producción diaria truncada:** `listarProduccionesDiarias` aplica `LIMIT 100` y responde `total: resultado.rows.length`, que no es el total histórico real. Necesita `COUNT(*)`, `page`, `pageSize`, `total`, `totalPages` y orden estable `fecha_produccion DESC, id DESC`. Evitar romper el frontend actual: migrar llamadas y conservar compatibilidad al introducir el endpoint paginado.
5. **Listas sin paginación:** el código de `listarAnimales`, `listarMovimientosFinancieros`, `listarInventario`, `listarMovimientosInventario`, historial de salud, pesajes, servicios y partos consulta los registros sin `LIMIT/OFFSET`. Riesgo de rendimiento con fincas grandes. La pantalla `Leche.jsx` consulta lactancias y producción animal por animal, provocando múltiples solicitudes (patrón N+1).
6. **IA y reportes no pueden compartir listados recortados:** `ganatecTools.service.js` usa límites (p. ej. 100 animales, 50 productos y 50 tratamientos en ciertos detalles); contar únicamente las filas devueltas produce conclusiones parciales. Usar `COUNT` y agregados SQL separados de los detalles paginados; marcar listados parciales.
7. **Fechas:** estandarizar `desde`/`hasta`, validar meses existentes y que `desde <= hasta`; rangos inclusivos por fecha local para columnas DATE y `[inicio, fin+1 día)` si la columna es timestamp. Definir explícitamente zona `America/Bogota`. Hay uso mixto de `CURRENT_DATE` y conversiones a Bogotá.
8. **Consultas eficientes:** evitar `TO_CHAR(fecha, 'YYYY-MM')` en `WHERE` por su impacto en índices; preferir filtros por rangos. Considerar índices compuestos por `finca_id, fecha, id` y las claves foráneas de las tablas involucradas, previa revisión de índices reales.
9. **Datos incompletos:** un reporte debe distinguir **cero real**, **sin datos en el periodo**, **fuente no consultada** y **dato no calculable**. No reemplazar con 0 un indicador no definido. En informes reproductivos, no calcular tasas de fertilidad sin definir población y periodo de exposición; no sumar crías y animales registrados como si fueran poblaciones diferentes sin verificar vínculos.
10. **Trazabilidad:** todo detalle debe incluir ID de origen, fecha y entidad asociada. Los exportables deben respetar filtros, finca y permisos. Mostrar fecha/hora de generación y leyenda de fuente de datos.
11. **Esquema y calidad:** no hay archivos de migraciones/definición SQL o pruebas automatizadas en los árboles revisados. Verificar constraints de duplicidad (fecha/turno/lactancia, registro diario por finca/fecha, movimientos con referencia) e índices en Neon antes de llamar al módulo «validado». La creación de leche usa comprobaciones previas, pero ello no certifica inmunidad a condiciones de carrera sin restricciones/transacciones adecuadas.

## Los cinco reportes propuestos

| # | Tipo | Fuentes verificadas en código | Contenido inicial | Precauciones |
|---|---|---|---|---|
| 1 | **Resumen operativo y hato** | `animales`, `pesajes`, `productos_inventario`, `movimientos_inventario`, `lotes`, `potreros` | Animales por estado/sexo, últimos pesajes, productos activos, bajo stock, lotes/potreros | No calcular valorización monetaria del inventario sin costos unitarios e históricos; diferenciar existencias actuales de históricas |
| 2 | **Reproducción** | `servicios_reproductivos`, `diagnosticos_gestacion`, `gestaciones`, `partos`, `crias_parto` | Servicios por periodo/tipo, diagnósticos, gestaciones activas, partos y crías | Evitar duplicar gestaciones por JOIN; indicadores reproductivos necesitan denominador y definición explícita |
| 3 | **Sanidad** | `eventos_salud`, `tratamientos`, `medicamentos_tratamiento`, `vacunaciones` | Eventos por gravedad/estado/tipo, tratamientos y vacunaciones, animales afectados | Sin diagnóstico veterinario inferido; tratamientos no necesariamente equivalen a eventos |
| 4 | **Producción de leche** | `registros_leche`, `lactancias`, `produccion_leche_diaria` | Litros por día/mes, producción detallada o total rápida, días registrados, promedio por día con registros, listado de ordeños | Resolver regla de exclusión entre fuentes; distinguir promedio por día registrado del promedio por día calendario |
| 5 | **Financiero** | `movimientos_financieros`, `ventas_leche`, `ventas_animales` | Ingresos, egresos, saldo registrado, categorías y movimientos del periodo | Solo administrador; no confundir saldo con utilidad; evitar duplicar ventas y sus movimientos financieros automáticos |

**Decisión de alcance:** reportes operativos agrupan inventario y potreros para cubrir el conjunto del sistema sin exceder cinco informes principales.

## Contrato propuesto para las consultas

`GET /api/reportes/:tipo?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&page=1&pageSize=25`

- `tipo`: uno de `operativo`, `reproduccion`, `sanidad`, `leche`, `financiero`; validar contra allowlist.
- `page`: entero ≥1; `pageSize`: 10, 25, 50 o 100; límite máximo 100. Aplicar `LIMIT` y `OFFSET` solo al detalle.
- `meta`: `{ page, pageSize, totalItems, totalPages, desde, hasta, generadoEn, zonaHoraria, detalleCompleto }`.
- `resumen`: agregados **sobre todos los registros filtrados**, nunca únicamente la página visible.
- `filas`: detalle paginado, con orden estable e IDs; máximo 100 registros por respuesta.
- `advertencias`: conflictos entre fuentes, ausencia de registros, indicadores no calculables y otros hallazgos de integridad.
- `exportación`: CSV/Excel/PDF con los mismos filtros y controles de autorización; no exportar solo página 1 ni contenido financiero para trabajadores. Para bases grandes usar paginado/streaming y límites explícitos.

## Verificaciones de base de datos antes de implementar

**No se ejecutaron.** Ejecutar en entorno de pruebas, con datos anonimizados:

1. Cantidad por finca y rango de fechas para cada tabla fuente.
2. Fechas con producción detallada y total rápida simultáneos (validación de doble conteo).
3. Duplicados de fecha/turno/lactancia y fecha de total diario/finca; revisar constraints reales.
4. Gestaciones sin servicio o partos sin enlaces completos, y eventos/tratamientos sin relaciones esperadas.
5. Movimientos de inventario con stock negativo, productos inactivos y unidades heterogéneas.
6. Ventas sin movimiento financiero correspondiente, o referencias financieras duplicadas.
7. Pruebas con 0, 25, 100 y 1000+ registros; última página, filtros de fechas, exportaciones y control de permisos entre dos fincas.
8. Rendimiento de EXPLAIN ANALYZE y pruebas visuales móviles/escritorio.

## Orden de implementación recomendado

1. Asegurar **reglas compartidas de cálculo** para leche; fijar semántica de periodos y movimientos financieros.
2. Definir **contrato paginado** y filtros validados con totales globales exactos. Migrar pantallas sin romper respuestas actuales.
3. Implementar **backend** de los cinco reportes con consultas SQL por finca, agregados y advertencias de calidad.
4. Crear **frontend** de reportes con filtros, tarjetas KPI, tabla paginada y estados vacíos; menú según rol.
5. Incorporar exportación controlada, pruebas unitarias/integración e índices. Comparar cada informe contra consultas SQL de referencia en una base de prueba.

**Aviso sobre sincronización de forks:** al revisar, `gabo52281/backend_ganatec:main` todavía tenía el SHA `5f60bec...` mientras el backend original ya estaba en `1607dd1...`; el frontend del fork también conservaba un `main` más antiguo que el del propietario. Antes de desarrollar y enviar PR de reportes se deben sincronizar los forks para evitar incorporar código obsoleto o diffs innecesarios.
