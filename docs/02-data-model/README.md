# Modelo de datos — Construction ERP

## Schema fuente de verdad

El **único schema Prisma en uso** por la aplicación es:

```
packages/database/prisma/schema.prisma
```

- Es el que usa `@repo/database` y Prisma Client.
- Incluye el **modelo completo recomendado para producción**, con:
  - 51 tablas base (organizations, projects, WBS, budget, finance, inventory, quality, etc.)
  - **6 tablas de proveedores globales:** GlobalParty, GlobalPartyContact, OrgPartyLink, GlobalPartyClaim, GlobalPartyReview, GlobalProduct.

**No edites** `docs/02-data-model/schema.prisma` para cambiar el comportamiento del sistema; es una copia de referencia. Cualquier cambio de modelo debe hacerse en `packages/database/prisma/schema.prisma` y, si se desea, sincronizarse a `docs/02-data-model/` para documentación.

**Flujo de cambios (ERD, migraciones, escalabilidad):** ver **[SCHEMA-AND-MIGRATIONS.md](SCHEMA-AND-MIGRATIONS.md)** — define cómo mantener schema, migraciones y ERD en sintonía.

---

## Documentos en esta carpeta

| Archivo | Descripción |
|---------|-------------|
| **schema.prisma** | Copia de referencia del schema (puede estar desactualizada respecto a `packages/database`). |
| **schema-supplier-updates.md** | Cambios y diseño de las tablas de proveedores globales. |
| **erd-complete.mmd** | ERD en Mermaid (51+ tablas). |
| **SCHEMA-AND-MIGRATIONS.md** | Flujo y reglas: schema, migraciones, ERD; fix para migración fantasma. |

---

## Alineación con el resumen ejecutivo

Según [final-summary](../00-overview/final-summary.md):

- **Recomendación:** Usar el schema **con proveedores globales** desde el inicio (estructura lista; UI en Phase 2).
- **Decisión:** El schema en `packages/database/prisma/schema.prisma` ya incluye GlobalParty, OrgPartyLink, etc. Es la base recomendada para producción y escalabilidad.

Para detalles del diseño del directorio global de proveedores, ver [supplier-directory-design.md](../03-business-requirements/supplier-directory-design.md).
