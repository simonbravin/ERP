# PDF Export Inventory (Phase 0)

All exports that currently show a "migration message" or had an old "Exportar PDF" path.  
**Zero** reintroduction of pdfkit/jspdf. Migrate to `/[locale]/print/*` + `GET /api/pdf?template=...`.

---

## Export Inventory

| # | Document name | Current screen route | Data source (existing actions) | Expected params | Target template id | Target print route |
|---|----------------|----------------------|----------------------------------|-----------------|--------------------|---------------------|
| 1 | Cómputo | `/[locale]/projects/[id]/budget/[versionId]/compute` | getBudgetVersion, listBudgetLines | versionId, locale | computo | `/[locale]/print/computo/[versionId]` |
| 2 | Materiales (consolidado) | `/[locale]/projects/[id]/budget/[versionId]/materials` | getConsolidatedMaterials(budgetVersionId) | versionId, locale | materials | `/[locale]/print/materials/[versionId]` |
| 3 | Presupuesto (líneas) | `/[locale]/projects/[id]/budget/[versionId]` | listBudgetLines, getBudgetVersion | versionId, locale | budget | `/[locale]/print/budget/[versionId]` |
| 4 | Transacciones empresa | `/[locale]/finance/transactions` | company transactions list (filters) | filters (projectId, type, partyId, status, dateFrom, dateTo, search), locale | transactions | `/[locale]/print/transactions?projectId=&dateFrom=&dateTo=&...` |
| 5 | Cashflow consolidado | `/[locale]/finance/cashflow` | getCompanyCashflowDetailed({ from, to }) | dateFrom, dateTo, locale | cashflow | `/[locale]/print/cashflow?from=&to=` |
| 6 | Certificaciones (proyecto) | `/[locale]/projects/[id]/certifications` o `.../finance/certifications` | certifications by projectId | projectId, locale | certification | `/[locale]/print/certification/[projectId]` |
| 7 | Dashboard Finanzas (ejecutivo) | `/[locale]/finance` | getFinanceExecutiveDashboard | (org from session), locale | finance-dashboard | `/[locale]/print/finance-dashboard` |
| 8 | Dashboard Proyecto | `/[locale]/projects/[id]/dashboard` | getProjectDashboardData(projectId) | projectId, locale | project-dashboard | `/[locale]/print/project-dashboard/[projectId]` |
| 9 | Compras por proveedor | `/[locale]/reports/predefined/purchases-multi-project` | getPurchasesBySupplierReport(orgId, partyId) | partyId (supplier), locale | purchases-by-supplier | `/[locale]/print/purchases-by-supplier?partyId=` |
| 10 | Cronograma (Gantt) | `/[locale]/projects/[id]/schedule` | getScheduleForView(scheduleId) | scheduleId, locale | schedule | `/[locale]/print/schedule/[scheduleId]` |

**Status:** All above items migrated (template + print route + UI calling `/api/pdf?template=...`).

---

## Out of scope (no PDF migration)

- **Overhead transactions:** "Exportación PDF no disponible para gastos generales" — leave as-is.
- **Projects list / Team members / Materials by supplier (per supplier) / Project cashflow:** Excel-only; no PDF action to migrate.

---

## Implementation order (by commit) — done

1. ✅ certification
2. ✅ transactions
3. ✅ budget + materials
4. ✅ schedule
5. ✅ cashflow
6. ✅ finance-dashboard + project-dashboard
7. ✅ purchases-by-supplier
8. ✅ docs

---

## New templates and print routes

**Templates** (in `apps/web/lib/pdf/templates/`): computo, transactions, certification, budget, materials, schedule, cashflow, finance-dashboard, project-dashboard, purchases-by-supplier.

**Print routes** (under `apps/web/app/[locale]/print/`):

- `computo/[versionId]` — Cómputo (existing)
- `certification/[projectId]` — Certificaciones por proyecto
- `transactions` — Transacciones empresa (query: projectId, type, partyId, status, dateFrom, dateTo, search)
- `budget/[versionId]` — Presupuesto (líneas)
- `materials/[versionId]` — Materiales consolidados
- `schedule/[scheduleId]` — Cronograma (tabla tareas)
- `cashflow` — Flujo de caja consolidado (query: from, to)
- `finance-dashboard` — Dashboard finanzas (resumen + tendencia + top proyectos)
- `project-dashboard/[projectId]` — Dashboard proyecto (resumen + cashflow)
- `purchases-by-supplier` — Compras por proveedor (query: partyId)

---

## URLs to test locally (with session)

- Cómputo: `http://localhost:3333/es/print/computo/<versionId>` · PDF: `GET /api/pdf?template=computo&id=<versionId>&locale=es`
- Certificaciones: `.../print/certification/<projectId>` · PDF: `?template=certification&id=<projectId>&locale=es`
- Transacciones: `.../print/transactions?dateFrom=...&dateTo=...` · PDF: `?template=transactions&locale=es&dateFrom=&dateTo=`
- Presupuesto: `.../print/budget/<versionId>` · PDF: `?template=budget&id=<versionId>&locale=es`
- Materiales: `.../print/materials/<versionId>` · PDF: `?template=materials&id=<versionId>&locale=es`
- Cronograma: `.../print/schedule/<scheduleId>` · PDF: `?template=schedule&id=<scheduleId>&locale=es`
- Cashflow: `.../print/cashflow?from=YYYY-MM-DD&to=YYYY-MM-DD` · PDF: `?template=cashflow&locale=es&from=&to=`
- Dashboard finanzas: `.../print/finance-dashboard` · PDF: `?template=finance-dashboard&locale=es`
- Dashboard proyecto: `.../print/project-dashboard/<projectId>` · PDF: `?template=project-dashboard&id=<projectId>&locale=es`
- Compras por proveedor: `.../print/purchases-by-supplier?partyId=<partyId>` · PDF: `?template=purchases-by-supplier&locale=es&partyId=<partyId>`
