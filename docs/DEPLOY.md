# Guía de despliegue a producción (MVP)

Esta guía es para llevar Bloqer a producción en **Vercel + Neon** desde cero (sin migrar datos desde localhost). Sigue los pasos en orden.

---

## Flujo de trabajo: local vs producción

**Desarrollo en local (nuevas funcionalidades, testear):**

- En `packages/database/` usá **`.env`** apuntando a **localhost** (PostgreSQL local). Copiá de `packages/database/.env.example` si no tenés uno. Si tu `.env` hoy apunta a Neon, reemplazalo con los valores de `.env.example` para desarrollar; las URLs de Neon dejalas solo en `.env.production.local`.
- Comandos: `pnpm dev`, `pnpm db:migrate` para cambios de schema. Probá todo en local.
- Cuando esté listo: **commit + push** a `main` (o tu rama). No hace falta tocar Neon para desarrollar.

**Producción (Vercel + Neon) — ya migraste:**

- Cada **push a `main`** dispara el deploy en Vercel. La app en producción usa las variables de entorno que configuraste en Vercel (DATABASE_URL, etc.) y la base Neon.
- **Migraciones en Neon:** no uses `.env` para eso. Tené `packages/database/.env.production.local` con las URLs de Neon y ejecutá:
  - `pnpm db:migrate:deploy:prod` — aplica migraciones en Neon.
  - `pnpm db:create-superadmin:prod` — crea o actualiza el usuario superadmin en Neon.
- **Registro de usuarios y comercializar:** si en Vercel tenés bien `DATABASE_URL`, `DIRECT_URL` (sin prefijo `psql '`), `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, la app en producción ya permite registro e inicio de sesión. Verificá con `/api/health` y probando registrar un usuario en portal.bloqer.app.

**Resumen:**

| Qué querés hacer | Dónde | Qué usar |
|------------------|-------|----------|
| Desarrollar y testear | Local | `.env` con localhost, `pnpm dev`, `pnpm db:migrate` |
| Subir código a producción | Git | `git push` a `main` → Vercel despliega solo |
| Aplicar migraciones en Neon | Local (una vez) | `.env.production.local` + `pnpm db:migrate:deploy:prod` |
| Crear/actualizar superadmin en Neon | Local (una vez) | `.env.production.local` + `pnpm db:create-superadmin:prod` |

---

## 1. Base de datos en Neon

1. Entra en [Neon](https://neon.tech) y crea una cuenta si no la tienes.
2. Crea un **nuevo proyecto** (por ejemplo `bloqer-prod`).
3. En el dashboard del proyecto:
   - Copia la **connection string** que te dan. En Neon suele haber dos:
     - **Pooled** (recomendado para la app): termina en `-pooler.region.neon.tech` y suele incluir `?sslmode=require` (añade `&pgbouncer=true` si no está).
     - **Direct** (solo para migraciones): la URL sin pooler, misma región y base de datos.
   - Si solo ves una URL, en la pestaña "Connection details" o "Connection string" suele permitir elegir "Pooled" vs "Direct".
4. Guarda temporalmente:
   - `DATABASE_URL` = URL **pooled** (ej. `postgresql://user:pass@ep-xxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true`).
   - `DIRECT_URL` = URL **direct** (ej. `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`).

No hace falta crear tablas a mano: las migraciones de Prisma las crearán en el paso 4.

---

## 2. Variables de entorno en Vercel

1. Abre tu proyecto en [Vercel](https://vercel.com) (o crea uno vinculado a este repo).
2. Ve a **Settings → Environment Variables**.
3. Añade las siguientes variables para **Production** (y, si quieres, Preview):

| Variable | Descripción | Ejemplo / Cómo obtenerla |
|----------|-------------|---------------------------|
| `NEXTAUTH_URL` | URL pública de la app | `https://tu-dominio.vercel.app` (ajusta tras el primer deploy) |
| `NEXTAUTH_SECRET` | Secreto para sesiones | `openssl rand -base64 32` |
| `AUTH_SECRET` | Usado por Auth.js | Mismo valor que NEXTAUTH_SECRET o otro generado igual |
| `DATABASE_URL` | PostgreSQL (Neon **pooled**) | Pegar desde Neon |
| `DIRECT_URL` | PostgreSQL (Neon **direct**) | Pegar desde Neon |
| `NEXT_PUBLIC_APP_URL` | URL pública (para links en emails, etc.) | Misma que NEXTAUTH_URL |
| `RESEND_API_KEY` | API key de Resend | Desde [Resend](https://resend.com) (paso 6) |
| `RESEND_FROM_EMAIL` | Remitente de emails | `Bloqer <notificaciones@tudominio.com>` o el que te den en Resend |
| `INNGEST_EVENT_KEY` | (Opcional) Si usas Inngest Cloud | Dashboard de Inngest |
| `INNGEST_SIGNING_KEY` | (Opcional) Si usas Inngest Cloud | Dashboard de Inngest |

**Importante:** El valor de `DATABASE_URL` y `DIRECT_URL` debe ser solo la URL (ej. `postgresql://user:pass@host/db?sslmode=require`). No incluyas el prefijo `psql '` ni comillas al final. En Neon, al copiar "connection string" quita ese prefijo. Para pooled (DATABASE_URL) añade `&pgbouncer=true` si no viene. Asegura que las variables estén asignadas al entorno **Production** y haz redeploy después de cambiarlas.

Puedes dejar R2 en blanco si no usas almacenamiento en Cloudflare aún.

---

## 3. Ejecutar migraciones contra Neon

Las tablas se crean con Prisma. Hay **una sola migración inicial** (`20250101000000_initial_schema`) que crea el schema completo; así `prisma migrate deploy` funciona en una base vacía.

**Env local vs prod:** En local usá siempre `packages/database/.env` (localhost). Para prod no edites ese `.env`: creá `packages/database/.env.production.local` (no se commitea; ya está en `.gitignore`) con `DATABASE_URL`, `DIRECT_URL` y si aplica `SUPER_ADMIN_PASSWORD` para Neon. Ejemplo:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
DIRECT_URL="postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
SUPER_ADMIN_PASSWORD="contraseña_segura"
```

Así nunca migrás al lugar equivocado.

**Base de datos nueva (Neon recién creada):**

1. Crea `packages/database/.env.production.local` con las URLs de Neon (pooled y direct).
2. En la raíz del monorepo:

```bash
pnpm db:migrate:deploy:prod
```

Eso carga `.env.production.local` y aplica las migraciones en Neon. La base queda lista. (Alternativa: usar `pnpm db:migrate:deploy` solo si ya tenés las variables de Neon en el entorno actual.)

**Si ya tenías una base en producción** creada con el historial de migraciones anterior, una sola vez marca la baseline como aplicada (sin ejecutarla) para alinear el historial:

```bash
cd packages/database && npx prisma migrate resolve --applied 20250101000000_initial_schema
```

A partir de ahí, cualquier cambio nuevo de schema: probar en local con `pnpm db:migrate` (genera una nueva migración), commitearla y en deploy ejecutar `pnpm db:migrate:deploy`.

**Regla de migraciones (obligatoria):**

- **Cambios de schema:** Siempre `pnpm db:migrate` en local (genera la migración). Hacé commit de la carpeta `packages/database/prisma/migrations/`.
- **Deploy / prod:** Ejecutá `pnpm db:migrate:deploy` (en CI o manual antes/después del deploy). No uses `db:migrate` ni `db:push` contra Neon desde una máquina suelta; usá el script de prod (ver sección 3 y 5).

---

## 4. Deploy en Vercel

La configuración de build y deploy está en el **`vercel.json` de la raíz del repo** (único punto de verdad). El deploy oficial se hace siempre con **Root Directory** = raíz del monorepo.

1. Conecta el repo si no está conectado (Vercel detecta el monorepo).
2. **Root Directory**: deja la raíz del repo (no `apps/web`).
3. **Build Command**: `pnpm exec turbo run build --filter=web` (definido en `vercel.json` de la raíz; el filtro lo aplica Turbo, no se pasa a Next.js).
4. **Install Command**: `pnpm install` (definido en `vercel.json` de la raíz).
5. **Output Directory**: `.next` (relativo a la raíz del proyecto; si en Vercel el Root Directory es `apps/web`, el output está en `apps/web/.next`).
6. Guarda y haz **Deploy**. Tras el primer deploy, copia la URL (ej. `https://bloqer-xxx.vercel.app`) y actualiza en Vercel:
   - `NEXTAUTH_URL`
   - `NEXT_PUBLIC_APP_URL`
   y vuelve a desplegar si hace falta.

---

## 5. Crear usuario Super Admin en producción

Tras el primer deploy, la base en Neon está vacía de usuarios. Para poder entrar al panel de Super Admin (`/super-admin/login`):

1. En `packages/database/.env.production.local` tené `DATABASE_URL`, `DIRECT_URL` y (recomendado) `SUPER_ADMIN_PASSWORD` para Neon. No uses `packages/database/.env` para prod: ese archivo debe quedar siempre para localhost.
2. (Recomendado) En `.env.production.local` define una contraseña segura:
   ```env
   SUPER_ADMIN_PASSWORD=tu_contraseña_segura_aqui
   ```
   Si no la defines, se usará la por defecto de desarrollo (`Livestrong=15`); en producción conviene usar una contraseña fuerte.
3. Desde la raíz del repo ejecutá:
   ```bash
   pnpm db:create-superadmin:prod
   ```
   Eso carga `.env.production.local` y crea/actualiza el superadmin en Neon.
4. El script crea (o actualiza) el usuario **superadmin** con `isSuperAdmin: true`. Luego podés entrar en:
   - **https://portal.bloqer.app/es/super-admin/login** (o tu dominio)
   - Usuario: `superadmin`
   - Contraseña: la que pusiste en `SUPER_ADMIN_PASSWORD` o la por defecto.

Solo hace falta ejecutarlo una vez por entorno (o cuando quieras resetear la contraseña del superadmin).

---

## 6. Comprobar que la app responde (producción lista para comercializar)

**Checklist:**

- [ ] En Vercel: `DATABASE_URL` y `DIRECT_URL` para **Production**, valor = solo la URL (sin `psql '` ni comillas). Redeploy después de cambiar.
- [ ] `/api/health` responde `{"status":"ok"}` (ej. `https://portal.bloqer.app/api/health`). Para diagnosticar env en runtime: `GET /api/env-check` devuelve si `DATABASE_URL` y `DIRECT_URL` están definidos (sin revelar valores).
- [ ] Registro de usuario nuevo funciona en la URL de producción.
- [ ] Inicio de sesión con ese usuario funciona.
- [ ] Super Admin: `pnpm db:create-superadmin:prod` ya ejecutado; podés entrar en `/es/super-admin/login` con usuario `superadmin`.

Si todo eso pasa, la app está activa y podés registrar clientes y comercializar.

**Debug en producción:** El widget de estado del sistema (flotante) solo se muestra si en Vercel definís `NEXT_PUBLIC_SHOW_DEBUG_WIDGET=true`. No lo definas en producción si no lo necesitás; el dashboard de Super Admin ya incluye un bloque de estado embebido para ops.

---

## 7. Emails con Resend (producción)

1. Entra en [Resend](https://resend.com), crea cuenta y verifica tu dominio (o usa el dominio de prueba que dan).
2. Crea una **API Key** y cópiala.
3. En Vercel añade (o actualiza):
   - `RESEND_API_KEY` = la API key.
   - `RESEND_FROM_EMAIL` = el remitente permitido (ej. `Bloqer <onboarding@resend.dev>` para pruebas o `Bloqer <notificaciones@tudominio.com>` con dominio verificado).
4. Redespliega para que tome las variables y prueba "Olvidé contraseña" e invitación a organización.

---

## 8. (Opcional) Inngest

Si usas [Inngest](https://inngest.com) en producción:

1. Crea app en Inngest Cloud y apunta la URL de tu API (ej. `https://tu-dominio.vercel.app/api/inngest`).
2. Añade en Vercel `INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` desde el dashboard de Inngest.
3. Redespliega.

---

## Resumen rápido (orden)

1. Crear proyecto Neon y copiar **pooled** + **direct** URLs.
2. Añadir en Vercel todas las variables (Auth, DB, Resend, opcional Inngest). Valores crudos: sin `psql '` ni comillas.
3. Crear `packages/database/.env.production.local` con esas URLs y ejecutar `pnpm db:migrate:deploy:prod`.
4. Deploy en Vercel (push a `main`); ajustar `NEXTAUTH_URL` y `NEXT_PUBLIC_APP_URL` con la URL final.
5. Crear superadmin en producción: `SUPER_ADMIN_PASSWORD` en `.env.production.local` + `pnpm db:create-superadmin:prod`.
6. Configurar Resend y probar emails.

A partir de aquí podés ir probando el MVP y, cuando quieras, añadir notificaciones por WhatsApp (ver plan de producción en el repo).
