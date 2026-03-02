# Migraciones Prisma – Bloqer

## Estructura actual

- **Una migración baseline:** `20250101000000_initial_schema` crea el schema completo (todas las tablas) en una base vacía. Así `prisma migrate deploy` funciona en Neon u otra base nueva sin pasos previos.
- Las migraciones incrementales antiguas se consolidaron en esta baseline; no se conserva carpeta de archivo.

## Regla de migraciones

- **Schema:** Siempre `pnpm db:migrate` en local; commit de `migrations/`.
- **Prod:** Solo `pnpm db:migrate:deploy` (o `db:migrate:deploy:prod` con env de Neon). Nunca `db:migrate` ni `db:push` contra producción.

## Flujo de trabajo

1. **Local (desarrollo):** Al cambiar `schema.prisma`, crear una migración:
   ```bash
   pnpm db:migrate
   ```
   (o `pnpm --filter @repo/database db:migrate`). Eso ejecuta `prisma migrate dev` y genera una nueva carpeta con timestamp en `migrations/`.

2. **Producción / CI:** Aplicar migraciones pendientes:
   ```bash
   pnpm db:migrate:deploy
   ```
   Así, cada push/deploy puede aplicar solo las migraciones nuevas sobre la baseline.

3. **Base ya existente (una sola vez):** Si la base de producción se creó con el historial antiguo, alinear con:
   ```bash
   cd packages/database && npx prisma migrate resolve --applied 20250101000000_initial_schema
   ```

## Regenerar la baseline (solo si hace falta)

Si en el futuro quisieras volver a generar una baseline desde el schema actual:

```bash
cd packages/database
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/NOMBRE_NUEVO/migration.sql
```

No borres ni edites a mano la baseline sin coordinar con el equipo; el deploy y los entornos dependen de ella.
