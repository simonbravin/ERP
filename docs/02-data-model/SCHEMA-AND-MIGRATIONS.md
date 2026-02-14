# Schema, migraciones y ERD — Una sola fuente de verdad

Este documento define **cómo mantener en sintonía** el modelo de datos con el ERD, el tech stack y las prácticas del proyecto. Es la referencia para escalabilidad y reusabilidad del modelo.

---

## 1. Fuente de verdad

| Qué | Dónde | Uso |
|-----|--------|-----|
| **Schema (implementación)** | `packages/database/prisma/schema.prisma` | Única fuente de verdad. Prisma Client y toda la app dependen de este archivo. |
| **Historial de cambios en DB** | `packages/database/prisma/migrations/` | Cada migración es inmutable una vez aplicada. No borrar ni renombrar migraciones ya desplegadas. |
| **ERD (diseño)** | `docs/02-data-model/erd-complete.mmd` | Vista de alto nivel y documentación. Debe reflejar el modelo; actualizar tras cambios relevantes. |

- **No** usar `docs/02-data-model/schema.prisma` para cambiar el sistema; es copia de referencia y puede quedar desactualizada.
- **Sí** editar solo `packages/database/prisma/schema.prisma` para cambios de modelo.

---

## 2. Flujo para cambiar el modelo (reutilizable)

Siempre que añadas tablas, campos o relaciones:

1. **Editar** `packages/database/prisma/schema.prisma`.
2. **Crear migración** desde el paquete database:
   ```bash
   cd packages/database
   pnpm exec prisma migrate dev --name descripcion_corta_snake_case
   ```
   - Genera el SQL en `migrations/YYYYMMDDHHMMSS_descripcion_corta_snake_case/migration.sql`.
   - Aplica la migración en la base de desarrollo y actualiza el cliente Prisma.
3. **Regenerar cliente** (si no se hizo en el paso anterior):
   ```bash
   pnpm exec prisma generate
   ```
4. **(Opcional)** Actualizar `docs/02-data-model/erd-complete.mmd` si el cambio es relevante para la vista de alto nivel (nueva entidad, relación importante).

En **producción / CI** usar solo:

```bash
cd packages/database
pnpm exec prisma migrate deploy
```

No usar `prisma db push` para esquema compartido; solo migraciones versionadas.

---

## 3. Reglas para no romper la sintonía

- **No borrar** archivos de migraciones que ya existan en el repo y que puedan estar aplicadas en alguna base (p. ej. en producción). Si una migración se aplicó por error o ya no aplica, corregir con una **nueva** migración que revierta o ajuste el estado.
- **No editar** el SQL de una migración ya aplicada. Si hay que corregir, hacerlo con una migración nueva.
- **Nombres de migración:** descriptivos y en `snake_case`, por ejemplo: `add_invitations`, `add_change_order_budget_impact_type_and_party`.
- **ERD:** el archivo `erd-complete.mmd` es documentación. Tras cambios relevantes en el schema (nuevas tablas, relaciones), actualizar el Mermaid para que el ERD siga siendo útil.

---

## 4. Estado roto: migración fantasma

Si aparece un error como:

```text
Could not find the migration file at prisma/migrations/XXXXX_nombre/migration.sql.
Please delete the directory or restore the migration file.
```

significa que en la base hay un registro en `_prisma_migrations` para una migración cuyo archivo **ya no existe** en el repo (por ejemplo, se borró o nunca se commitió).

**Solución recomendada (una sola vez por base afectada):**

1. Conectar a la base (misma que usa la app, p. ej. `construction_erp`).
2. Eliminar **solo** la fila de la migración fantasma:

```sql
DELETE FROM public._prisma_migrations
WHERE migration_name = '20260203120001_inventory_items_require_category_id';
```

(Sustituir `20260203120001_inventory_items_require_category_id` por el nombre que indique el error.)

3. Aplicar migraciones pendientes:

```bash
cd packages/database
pnpm exec prisma migrate deploy
```

Así el historial de la base queda alineado con las migraciones que **sí** existen en el repo; no se borran migraciones del código.

---

## 5. Resumen

- **ERD:** documento de diseño; actualizarlo cuando el modelo cambie de forma relevante.
- **Tech stack:** Prisma + PostgreSQL; cambios de modelo solo vía `schema.prisma` + migraciones.
- **Escalabilidad:** migraciones versionadas y no modificables una vez aplicadas.
- **Reusabilidad:** una sola fuente de verdad (`packages/database/prisma/schema.prisma`) para toda la app y para cualquier herramienta que genere código o docs a partir del schema.

Seguir este flujo garantiza que el ERD, el schema y las bases de datos (dev/prod) permanezcan alineados y que el equipo y las herramientas (incluido Cursor) trabajen sobre la misma definición del modelo.
