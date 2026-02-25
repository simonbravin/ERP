# Contexto para IA (Bloqer)

## Exportación a PDF

- **Patrón:** Rutas de impresión bajo `[locale]/print/` (ej. `/es/print/computo/[versionId]`) renderizan HTML pensado para impresión, con layout común (header org, sin sidebar). El endpoint `GET /api/pdf?doc=...&id=...&locale=...` genera el PDF con headless Chromium (puppeteer-core + @sparticuz/chromium).
- **Generación:** `lib/pdf/render-pdf.ts` — `renderUrlToPdf(url, cookies, options)`. Se reenvían las cookies de la request al headless para que la sesión sea la del usuario. Se usa `page.emulateMediaType('print')` y `footerTemplate` de Puppeteer para "Página X de Y".
- **Permisos y multi-tenant:** Tanto las rutas `/print` como el API validan sesión y ámbito por `orgId`. El recurso (ej. versionId) debe pertenecer a la organización del usuario.
