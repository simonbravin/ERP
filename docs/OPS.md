# Operaciones y despliegue

## Exportación a PDF (HTML → PDF)

### Cómo probar

- **Vista print (navegador):**  
  Con sesión iniciada, abrir:  
  `http://localhost:3333/<locale>/print/computo/<versionId>`  
  Ejemplo: `http://localhost:3333/es/print/computo/clxxxxxx`

- **API PDF (descarga):**  
  Con sesión (cookies) en el mismo origen:  
  `GET http://localhost:3333/api/pdf?doc=computo&id=<versionId>&locale=es`

### Variables de entorno

- `NEXTAUTH_SECRET` — Requerido para validar sesión en `/api/pdf`.
- `NEXTAUTH_URL` — URL base de la app (usada para construir la URL interna del print en el API). En Vercel suele inferirse.
- `VERCEL_URL` — En Vercel, se usa como base para la URL del print.
- `PDF_USE_LOCAL_CHROME` — Opcional. Si es `true`, en local se usa Chrome instalado en el sistema en lugar del binario de @sparticuz/chromium.

### Troubleshooting

- **Timeout al generar PDF:** En serverless (Vercel) el límite de ejecución puede cortar PDFs muy grandes. Reducir contenido o aumentar timeout si la plataforma lo permite.
- **PDF en blanco o sin estilos:** Comprobar que la URL print carga bien en el navegador con la misma sesión. Revisar que las cookies se reenvían correctamente al headless.
- **Chromium no encontrado (local):** Con `PDF_USE_LOCAL_CHROME=true` asegurarse de tener Chrome instalado en la ruta esperada (Windows/Mac/Linux).
