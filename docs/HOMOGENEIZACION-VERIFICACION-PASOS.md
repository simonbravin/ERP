# Plan para verificar la implementación paso a paso (Homogeneización filtros y export)

Este documento define los pasos para comprobar que la homogeneización de filtros, export y resúmenes se aplica correctamente en cada área, sin romper funcionalidad ni cambiar el contenido de CSV/PDF.

---

## Resumen de pasos (checklist general)

1. **Fase 0 – Mapeo:** Completar la tabla "Inventario por página" y revisar la "Matriz de regresión". No iniciar refactor sin esto. ✅ (tabla y matriz definidas)
2. **Fase 1 – Componentes:** Crear `ListFiltersBar`, `ExportDropdown`, `SummaryCard`, `buildCsvWithHeader`. Verificar con "Paso 1". ✅
3. **Fase 2 – Finanzas:** Migrar AP, AR, transacciones, proyección, cashflow. ✅
4. **Fase 3 – Reportes y documentos:** Migrar reportes (run + predefinido gastos por proveedor); documentos sin export listado. ✅
5. **Fase 4 – Resto:** Calidad, certificaciones, change orders, inventario, proveedores, equipo, proyectos. ✅
6. **Cierre:** Comprobar "Paso 5 – Criterios finales" y ejecutar manualmente la matriz de regresión. ⏳ (pendiente pruebas manuales)

---

## Fase 0 – Mapeo (completar antes de refactor)

### Inventario por página

Completar esta tabla antes de tocar código. Para cada fila, anotar: filtros actuales, parámetros que envían, acción/API de export, template PDF si aplica, query params del PDF.

| Página | Ruta / componente | Filtros (params) | Export (formato, desde dónde, acción/API) | PDF template + params |
|--------|-------------------|------------------|-------------------------------------------|------------------------|
| Cuentas por pagar (empresa) | `finance/accounts-payable`, `AccountsPayableListClient` | dueDateFrom, dueDateTo, partyId, projectId → `getCompanyAccountsPayable(filters)` | — | — |
| Cuentas por pagar (proyecto) | `projects/[id]/finance/accounts-payable`, idem client | idem → `getProjectAccountsPayable(projectId, filters)` | — | — |
| Cuentas por cobrar (empresa) | `finance/accounts-receivable`, `AccountsReceivableListClient` | idem → `getCompanyAccountsReceivable` | — | — |
| Cuentas por cobrar (proyecto) | `projects/[id]/finance/accounts-receivable` | idem → `getProjectAccountsReceivable(projectId, filters)` | — | — |
| Transacciones proyecto | `projects/[id]/finance/transactions`, `ProjectTransactionsListClient` | según filtros del componente | Excel (columnas seleccionables), `exportProjectTransactionsToExcel(projectId, selectedColumns)` | — |
| Proyección caja | `projects/[id]/finance/cash-projection` | fechas, proyecto (en URL/estado) | PDF: `/api/pdf?template=cashflow&from=&to=&locale=&showEmitidoPor=&showFullCompanyData=` | cashflow (query: from, to, showEmitidoPor, showFullCompanyData) |
| Cashflow | `finance/cashflow` o proyecto, `CashflowExportToolbar` | from, to (params) | PDF misma URL template=cashflow + from, to, showEmitidoPor, showFullCompanyData | cashflow |
| Reportes guardados (run) | `reports/[id]/run` | query builder (ExecuteCustomQuery) | Excel/CSV: `GET /api/reports/[id]/export?format=EXCEL|CSV` | — |
| Predefinidos (gastos, top materials, budget-vs-actual, etc.) | `reports/predefined/...` (ej. `ProgressVsCostReportClient`, `TopMaterialsReportClient`) | fechas, proyecto según página | CSV en cliente (Blob + download) o API | gastos-por-proveedor, budget-vs-actual, progress-vs-cost, top-materials, certifications-report según página |
| Presupuesto (versión) | budget, `BudgetVersionExport` | — | Excel, `exportBudgetToExcel(versionId, selectedColumns)` | budget (print/[versionId]) |
| PO (orden de compra) | `projects/[id]/finance/purchase-orders/[commitmentId]`, `CommitmentDetailView` | — | PDF + Excel: `exportPurchaseOrderToExcel(commitmentId, columns)`; PDF vía `/api/pdf?template=purchase-order&id=` | purchase-order (id=commitmentId) |
| Cronograma | `projects/[id]/schedule`, `ScheduleViewClient` | — | PDF: link con `/api/pdf?template=schedule&id=scheduleId` | schedule (id=scheduleId) |
| Equipo | `team`, `TeamMembersTable` | — | Excel, `exportTeamToExcel(selectedColumns)` | — |

### Matriz de regresión (flujos a probar después de cada cambio)

Marcar cada flujo cuando se haya verificado tras un cambio.

- [ ] **AP empresa:** Filtrar por proyecto + rango fechas → Aplicar → lista actualizada; mismos ítems que antes.
- [ ] **AP proyecto:** Filtrar por proveedor + fechas → Aplicar → lista correcta; saldo a pagar visible si aplica.
- [ ] **AR empresa/proyecto:** Idem con cliente; saldo a cobrar si aplica.
- [ ] **Transacciones proyecto:** Filtros (si existen) → Export Excel → mismo conjunto de columnas y datos.
- [ ] **Proyección caja:** Elegir proyecto y rango → Export PDF → cabecera con org y proyecto; mismos datos en tabla.
- [ ] **Cashflow:** Parámetros from/to → Export PDF → cabecera y datos correctos.
- [ ] **Reporte guardado:** Ejecutar reporte → Export Excel → mismo archivo que antes; Export CSV → mismo contenido.
- [ ] **Predefinido (ej. gastos por proveedor):** Filtros → Export CSV/PDF → nombre org, proyecto si aplica, fecha en cabecera o contenido.
- [ ] **Presupuesto:** Export Excel → mismas columnas y totales.
- [ ] **PO:** Descargar PDF y Excel → mismo contenido que antes.
- [ ] **Cronograma:** Export PDF → proyecto y org en cabecera.
- [ ] **Equipo:** Export Excel → mismas columnas.

---

## Pasos de verificación por fase de implementación

### Paso 1 – Tras crear componentes (Fase 1)

- [x] **ListFiltersBar:** Renderiza contenedor con label "Filtros" (common.filters); acepta children; estilos: card, flex wrap, gap.
- [x] **ExportDropdown:** Botón/dropdown según formatos; estado loading (Loader2); common.export, exportExcel, exportCsv, exportPdf, exporting.
- [x] **SummaryCard:** Icono + label + value; opcional action; mismo estilo que bloque AP/AR.
- [x] **buildCsvWithHeader:** Helper en `lib/export/build-csv-with-header.ts`; cabecera opcional, BOM, escape CSV.

### Paso 2 – Tras migrar Finanzas (Fase 2)

- [x] AP empresa y proyecto: `ListFiltersBar`, SummaryCard (saldo), Aplicar/Limpiar (common).
- [x] AR idem.
- [x] Transacciones proyecto: ListFiltersBar, SummaryCard (balance), export con common.export.
- [x] Proyección: ListFiltersBar; cashflow: toolbars sin cambio de params PDF.
- [ ] Ejecutar ítems de matriz para finanzas (prueba manual).

### Paso 3 – Tras migrar Reportes y Documentos (Fase 3)

- [x] Run report: ExportDropdown (excel/csv), reports.exportReportHint; mismo contenido vía API.
- [x] Predefinido gastos por proveedor: ExportDropdown (csv + pdf), mismo template/params.
- [x] Documentos: sin export listado; N/A.
- [ ] Ejecutar ítems de matriz para reportes (prueba manual).

### Paso 4 – Tras migrar resto (Fase 4)

- [x] Calidad: RfiList, SubmittalList con ListFiltersBar + Limpiar.
- [x] Certificaciones: SummaryCard (total aprobado), ListFiltersBar (estado, período, orden), export con common.export.
- [x] Change orders: ListFiltersBar (estado) + Limpiar.
- [x] Inventario ítems: ListFiltersBar (buscar, categoría, stock) Aplicar/Limpiar; movimientos: common.clear en “Limpiar filtros”.
- [x] Proveedores: ListFiltersBar (búsqueda, categoría) Aplicar/Limpiar.
- [x] Equipo: botón export con common.export.
- [x] Proyectos: ListFiltersBar (estado, fase) + Limpiar; export con common.export.
- [ ] Ejecutar ítems de matriz para resto (prueba manual).

### Paso 5 – Criterios finales (Cierre)

- [x] Pantallas con listado/filtros usan `ListFiltersBar` (finanzas, calidad, certificaciones, change orders, inventario ítems, proveedores, proyectos; transacciones empresa).
- [x] Export: mismo patrón (common.export, ExportDropdown donde aplica, estado loading); ReportExportPdfButton usa common.exporting y common.exportPdf.
- [x] Totales/KPI: SummaryCard en AP/AR (saldo), transacciones proyecto (balance), certificaciones (total aprobado), transacciones empresa (balance).
- [x] i18n: common.filters, common.apply, common.clear, common.loading, common.export, common.exporting, common.exportExcel, common.exportCsv, common.exportPdf.
- [ ] CSV con cabecera estándar: buildCsvWithHeader disponible; aplicar en más predefinidos si se requiere (opcional).
- [x] PDFs: mismos templates y params; sin cambio de contrato.
- [ ] **Matriz de regresión:** ejecutar manualmente todos los flujos listados arriba y marcar en la matriz cuando pasen.

---

## Uso

1. Completar la tabla de **Inventario por página** y la **Matriz de regresión** (Fase 0).
2. Tras cada fase de implementación, ir marcando los checkboxes de los pasos correspondientes y de la matriz.
3. Si algún flujo falla, corregir antes de seguir; no marcar hasta que pase.
4. Repo público: CI/Vercel pueden redeployar sin bloqueos de branch protection.
