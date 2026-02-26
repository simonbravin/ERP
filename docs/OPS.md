# Operaciones y despliegue

## Exportación a PDF (HTML → PDF)

### Cómo probar

- **Vista print (navegador):**  
  Con sesión iniciada, abrir:  
  `http://localhost:3333/<locale>/print/computo/<versionId>`  
  Ejemplo: `http://localhost:3333/es/print/computo/clxxxxxx`

- **API PDF (descarga):**  
  Con sesión (cookies) en el mismo origen:  
  `GET http://localhost:3333/api/pdf?template=computo&id=<versionId>&locale=es`

### Smoke test pre-release (10 exportaciones PDF)

Comprobar que cada documento carga en print y que el API devuelve PDF. Sustituir `<versionId>`, `<projectId>`, `<scheduleId>`, `<partyId>` y fechas por valores válidos con sesión activa.

| # | Documento | Print URL | API PDF (`GET /api/pdf?template=...`) |
|---|-----------|-----------|--------------------------------------|
| 1 | Cómputo | `/<locale>/print/computo/<versionId>` | `template=computo&id=<versionId>&locale=es` |
| 2 | Certificaciones | `/<locale>/print/certification/<projectId>` | `template=certification&id=<projectId>&locale=es` |
| 3 | Transacciones | `/<locale>/print/transactions?dateFrom=&dateTo=` | `template=transactions&locale=es&dateFrom=&dateTo=` |
| 4 | Presupuesto | `/<locale>/print/budget/<versionId>` | `template=budget&id=<versionId>&locale=es` |
| 5 | Materiales | `/<locale>/print/materials/<versionId>` | `template=materials&id=<versionId>&locale=es` |
| 6 | Cronograma | `/<locale>/print/schedule/<scheduleId>` | `template=schedule&id=<scheduleId>&locale=es` |
| 7 | Cashflow | `/<locale>/print/cashflow?from=&to=` | `template=cashflow&locale=es&from=&to=` |
| 8 | Dashboard finanzas | `/<locale>/print/finance-dashboard` | `template=finance-dashboard&locale=es` |
| 9 | Dashboard proyecto | `/<locale>/print/project-dashboard/<projectId>` | `template=project-dashboard&id=<projectId>&locale=es` |
| 10 | Compras por proveedor | `/<locale>/print/purchases-by-supplier?partyId=` | `template=purchases-by-supplier&locale=es&partyId=` |

### Variables de entorno

- `NEXTAUTH_SECRET` — Requerido para validar sesión en `/api/pdf`.
- `NEXTAUTH_URL` — URL base de la app (usada para construir la URL interna del print en el API). En Vercel suele inferirse.
- `VERCEL_URL` — En Vercel, se usa como base para la URL del print.
- `PDF_USE_LOCAL_CHROME` — Opcional. Si es `true`, en local se usa Chrome instalado en el sistema en lugar del binario de @sparticuz/chromium.

### Troubleshooting

- **Timeout al generar PDF:** En serverless (Vercel) el límite de ejecución puede cortar PDFs muy grandes. Reducir contenido o aumentar timeout si la plataforma lo permite.
- **PDF en blanco o sin estilos:** Comprobar que la URL print carga bien en el navegador con la misma sesión. Revisar que las cookies se reenvían correctamente al headless.
- **Chromium no encontrado (local):** Con `PDF_USE_LOCAL_CHROME=true` asegurarse de tener Chrome instalado en la ruta esperada (Windows/Mac/Linux).
