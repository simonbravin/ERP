# Desarrollo local (localhost)

Para testear en local **sin afectar producción**:

## 1. Base de datos local

- **Opción A – Docker:**  
  `docker compose up -d`  
  (Levanta Postgres en `localhost:5432`, base `bloqer`, user/pass `postgres`/`postgres`.)

- **Opción B – PostgreSQL instalado:**  
  Crear una base llamada `bloqer` y usuario `postgres` con contraseña `postgres` (o ajustar `packages/database/.env` y `apps/web/.env.local`).

## 2. Migraciones y datos de prueba

Con Postgres corriendo, desde la raíz del repo:

```bash
pnpm db:migrate:deploy   # aplica migraciones a la base local
pnpm db:seed             # crea superadmin + usuario dev + datos de ejemplo
```

## 3. Usuarios de prueba (después del seed)

| Usuario     | Login / Email           | Contraseña      |
|------------|-------------------------|------------------|
| Super Admin | `superadmin`           | `Livestrong=15`  |
| Dev         | `Simon` o `simon@dev.local` | `Livestrong=15`  |

## 4. Arrancar la app

```bash
pnpm dev
```

Abre `http://localhost:3333` e inicia sesión con uno de los usuarios de arriba.

## Env: local vs producción

- **Local:**  
  `packages/database/.env` y `apps/web/.env.local` apuntan a **localhost**.  
  `pnpm dev`, `pnpm db:migrate:deploy`, `pnpm db:seed` usan solo la base local.

- **Producción (Neon):**  
  Las URLs de Neon están en `packages/database/.env.production.local`.  
  Solo se usan con comandos explícitos de prod, por ejemplo:  
  `pnpm db:migrate:deploy:prod`, `pnpm db:create-superadmin:prod`.  
  No se usan al hacer `pnpm dev` ni `pnpm db:seed`.

Así podés testear en local sin tocar producción.
