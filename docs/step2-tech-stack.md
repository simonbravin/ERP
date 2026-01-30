# PASO 2: Tech Stack Definitivo

## 🎯 Stack Seleccionado: Next.js Full-Stack

Después del análisis, la recomendación es **simplificar** eliminando NestJS y usando Next.js full-stack.

---

## 📦 Stack Completo

### Frontend
```yaml
Framework: Next.js 15 (App Router)
Language: TypeScript 5.3+
Styling: TailwindCSS 4
Components: shadcn/ui + Radix UI
Icons: lucide-react
```

### Backend (en Next.js)
```yaml
API: Next.js API Routes + Server Actions
Validation: Zod
Auth: next-auth v5 (Auth.js)
```

### Database
```yaml
Database: PostgreSQL 16
ORM: Prisma 5.x
Hosting: Neon (serverless PostgreSQL)
Alternative: Supabase
```

### State Management
```yaml
Server State: TanStack Query v5
Forms: react-hook-form + Zod
Tables: TanStack Table v8
```

### Jobs & Background Tasks
```yaml
Jobs: Inngest (serverless background jobs)
Alternative: Trigger.dev
Why: Built-in retry, no SQS/Workers needed
```

### Storage
```yaml
Files: Cloudflare R2 (S3-compatible)
Alternative: AWS S3
Why R2: Cheaper egress, S3-compatible API
```

### Email
```yaml
Provider: Resend
Why: Developer-friendly, React email templates
```

### Monitoring
```yaml
Errors: Sentry
Analytics: Vercel Analytics
Logs: Vercel Logs (production)
APM: Optional - Highlight.io
```

### Deployment
```yaml
Platform: Vercel
Database: Neon / Supabase
Storage: Cloudflare R2
Jobs: Inngest Cloud
```

---

## 🗂️ Estructura del Monorepo

### Opción Recomendada: Turborepo Simple

```
construction-erp/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── apps/
│   └── web/                    # Next.js app
│       ├── app/                # App Router
│       │   ├── (auth)/         # Auth routes
│       │   ├── (dashboard)/    # Protected routes
│       │   ├── api/            # API routes
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       └── package.json
│
├── packages/
│   ├── database/               # Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── client.ts       # Prisma client
│   │   │   └── seed.ts
│   │   └── package.json
│   │
│   ├── validators/             # Zod schemas
│   │   ├── src/
│   │   │   ├── auth.ts
│   │   │   ├── project.ts
│   │   │   ├── budget.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── ui/                     # shadcn components
│   │   ├── src/
│   │   │   └── components/
│   │   └── package.json
│   │
│   └── types/                  # Shared TypeScript types
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── tooling/
│   ├── eslint/
│   ├── prettier/
│   └── typescript/
│
├── docs/                       # 📁 ESTA CARPETA YA EXISTE
│   ├── erd-improved-complete.mmd
│   ├── technical-product-overview.md
│   ├── brd.md
│   └── architecture-improvements.md
│
├── .env.example
├── .gitignore
├── package.json
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## 📝 Package.json Root

```json
{
  "name": "construction-erp",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "tooling/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "db:generate": "turbo run db:generate",
    "db:push": "turbo run db:push",
    "db:studio": "turbo run db:studio",
    "db:migrate": "turbo run db:migrate"
  },
  "devDependencies": {
    "@turbo/gen": "^2.0.0",
    "prettier": "^3.2.5",
    "turbo": "^2.0.0",
    "typescript": "^5.3.3"
  },
  "packageManager": "pnpm@9.1.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## 🔧 Turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 🗄️ Database: Neon vs Supabase

### Opción 1: Neon (Recomendada)
```yaml
Pros:
  - Serverless PostgreSQL
  - Branching (dev/staging/prod)
  - Autoscaling
  - Generous free tier
  - Solo PostgreSQL (no extras)
  
Cons:
  - No auth built-in
  - No storage built-in

Free Tier:
  - 0.5GB storage
  - 100 compute hours/month
  - 10 branches
```

### Opción 2: Supabase
```yaml
Pros:
  - PostgreSQL + Auth + Storage
  - Real-time subscriptions
  - Edge Functions
  - Dashboard UI
  
Cons:
  - Más "opinado"
  - Lock-in mayor

Free Tier:
  - 500MB database
  - 1GB storage
  - 50,000 monthly active users
```

### ✅ Decisión: Neon
**Por qué:**
- Solo necesitamos PostgreSQL
- Auth con next-auth (más control)
- Storage con R2 (más barato)
- Branching es killer feature para dev

---

## 🔐 Auth: next-auth v5

```typescript
// apps/web/auth.ts
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { db } from "@repo/database"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  providers: [
    Google,
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        // Validate + return user
      },
    }),
  ],
  callbacks: {
    session({ session, token }) {
      session.user.id = token.sub!
      return session
    },
  },
})
```

---

## 📦 Key Dependencies

### apps/web/package.json
```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@repo/database": "workspace:*",
    "@repo/validators": "workspace:*",
    "@repo/ui": "workspace:*",
    
    "next-auth": "^5.0.0-beta",
    "@tanstack/react-query": "^5.28.0",
    "@tanstack/react-table": "^8.12.0",
    "react-hook-form": "^7.50.0",
    "zod": "^3.22.4",
    
    "inngest": "^3.15.0",
    "@aws-sdk/client-s3": "^3.515.0",
    "@aws-sdk/s3-request-presigner": "^3.515.0",
    
    "lucide-react": "^0.344.0",
    "tailwindcss": "^4.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  }
}
```

### packages/database/package.json
```json
{
  "dependencies": {
    "@prisma/client": "^5.10.0"
  },
  "devDependencies": {
    "prisma": "^5.10.0"
  },
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx src/seed.ts"
  }
}
```

---

## 🌍 Environment Variables

### .env.example
```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db"
DIRECT_URL="postgresql://user:pass@host/db" # For migrations

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Storage
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET_NAME="construction-erp-dev"
R2_PUBLIC_URL="https://pub-xyz.r2.dev"

# Jobs
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# Email
RESEND_API_KEY=""

# Monitoring
SENTRY_DSN=""
NEXT_PUBLIC_SENTRY_DSN=""
```

---

## 🏗️ Arquitectura de Carpetas en apps/web

```
apps/web/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Protected layout
│   │   ├── dashboard/
│   │   ├── projects/
│   │   │   ├── [id]/
│   │   │   │   ├── budget/
│   │   │   │   ├── certifications/
│   │   │   │   └── page.tsx
│   │   │   └── page.tsx
│   │   ├── finance/
│   │   ├── inventory/
│   │   ├── quality/              # RFIs, Submittals
│   │   └── settings/
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   ├── projects/
│   │   ├── budget/
│   │   └── webhooks/
│   │
│   └── layout.tsx
│
├── components/
│   ├── ui/                       # shadcn components
│   ├── layouts/
│   ├── forms/
│   └── tables/
│
├── lib/
│   ├── auth.ts                   # next-auth config
│   ├── db.ts                     # Prisma client import
│   ├── storage.ts                # R2 client
│   └── utils.ts
│
├── server/                       # Server Actions
│   ├── actions/
│   │   ├── auth.ts
│   │   ├── projects.ts
│   │   ├── budget.ts
│   │   └── ...
│   └── queries/
│       ├── projects.ts
│       └── ...
│
└── inngest/                      # Background jobs
    ├── client.ts
    └── functions/
        ├── export-budget.ts
        ├── send-notification.ts
        └── process-certification.ts
```

---

## 🎨 Styling: TailwindCSS + shadcn

### tailwind.config.ts
```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // ... shadcn colors
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

---

## 🧪 Testing Stack (Opcional para MVP)

```yaml
Unit Tests: Vitest
Integration: Playwright
E2E: Playwright
Coverage: Vitest coverage
```

Recomendación: **Agregar testing en Fase 2**, después del MVP.

---

## ✅ STACK FINALIZADO

### Decisiones Clave:
1. ✅ **Next.js full-stack** (no NestJS)
2. ✅ **Neon PostgreSQL** (serverless)
3. ✅ **Prisma ORM**
4. ✅ **next-auth v5** (auth)
5. ✅ **Inngest** (jobs)
6. ✅ **Cloudflare R2** (storage)
7. ✅ **Resend** (email)
8. ✅ **Vercel** (deployment)
9. ✅ **Turborepo** (monorepo)
10. ✅ **shadcn/ui** (components)

### Por qué este stack:
- ✅ **Simple**: Un solo framework (Next.js)
- ✅ **Moderno**: Latest versions de todo
- ✅ **Escalable**: Serverless, edge-ready
- ✅ **Económico**: Neon + R2 + Vercel free tiers generosos
- ✅ **DX**: TypeScript end-to-end, hot reload, etc

---

## Siguiente: PASO 3 - Generar Prisma Schema
