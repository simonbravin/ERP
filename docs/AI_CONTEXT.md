# Contexto para IA (Bloqer)

## Exportación a PDF

- **Patrón:** Rutas de impresión bajo `[locale]/print/` (ej. `/es/print/computo/[versionId]`) renderizan HTML pensado para impresión, con layout común (header org, sin sidebar). El endpoint `GET /api/pdf?template=...&id=...&locale=...` genera el PDF con headless Chromium (puppeteer-core + @sparticuz/chromium). **Nunca usar `doc=`. Solo `template=` en `/api/pdf`.**
- **Generación:** `lib/pdf/render-pdf.ts` — `renderUrlToPdf(url, cookies, options)`. Se reenvían las cookies de la request al headless para que la sesión sea la del usuario. Se usa `page.emulateMediaType('print')` y `footerTemplate` de Puppeteer para "Página X de Y".
- **Permisos y multi-tenant:** Tanto las rutas `/print` como el API validan sesión y ámbito por `orgId`. El recurso (ej. versionId) debe pertenecer a la organización del usuario.
- **Cabecera legal:** El label y valor del identificador fiscal en el header se obtienen con `getLegalIdDisplay()` (`lib/print/legal-id.ts`). Por jurisdicción: Panama → RUC, Argentina → CUIT, resto → ID Fiscal. El valor viene de `OrgProfile.taxId`; la etiqueta no se hardcodea en el componente.

## Document Templates

All PDFs are defined as **Document Templates** in `lib/pdf/templates/`. Each template implements the contract in `lib/pdf/document-template.ts` (id, buildPrintUrl, getFileName, validateAccess). The API `GET /api/pdf` accepts `?template=<id>` only (no `doc=`). It uses the registry only; it contains no document-specific logic. New exportable documents must be added by creating a new template file and registering it in `templates/index.ts`.

**Supported template ids:** computo, transactions, certification, budget, materials, schedule, cashflow, finance-dashboard, project-dashboard, purchases-by-supplier.
