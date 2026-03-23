# Bloqer

Bloqer — SaaS multi-tenant para gestión de construcción. Turborepo monorepo.

## Quick start

1. **Install dependencies**
   ```bash
   pnpm install
   ```
   (After install, `postinstall` runs `pnpm run db:generate` so the Prisma client is generated. If you see a Prisma "schema not found" warning during install, you can ignore it or run `PRISMA_SKIP_POSTINSTALL_GENERATE=1 pnpm install` to suppress it.)

2. **Copy environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set `DATABASE_URL` and `DIRECT_URL` when you add the database package.

3. **Develop**
   ```bash
   pnpm dev
   ```
   Runs all workspace apps in dev mode (add Next.js to `apps/web` first).

4. **Build**
   ```bash
   pnpm build
   ```

5. **Lint & format**
   ```bash
   pnpm lint
   pnpm format
   ```

6. **TypeScript**
   ```bash
   pnpm typecheck
   ```
   Runs Turbo `typecheck` across the repo: builds workspace dependencies that emit types (for example `@repo/validators` and Prisma client generation) and then runs `tsc --noEmit` in `apps/web` and `packages/validators`. To typecheck only the Next app with a manual validators build, use `pnpm typecheck:web`.

   **Full gate before merge or release** (types + Next production compile, same as CI should run):

   ```bash
   pnpm verify
   ```

   This runs `typecheck` then `turbo build --filter=web`. `next build` also type-checks the app (`typescript.ignoreBuildErrors` is off).

7. **Database** (after Prisma is set up in `packages/database`)
   ```bash
   pnpm db:generate   # Generate Prisma client
   pnpm db:push       # Push schema (dev)
   pnpm db:migrate    # Run migrations
   pnpm db:studio     # Open Prisma Studio
   ```

## Structure

- `apps/web` — Next.js app (to be set up)
- `packages/database` — Prisma schema and client
- `packages/validators` — Zod schemas
- `packages/ui` — shadcn components
- `tooling/typescript` — Shared TypeScript configs

See [docs/01-architecture/step2-tech-stack.md](docs/01-architecture/step2-tech-stack.md) for full architecture.
