# Guía: Usar Cursor para Desarrollar el Construction ERP

## 🎯 Objetivo

Configurar Cursor correctamente y generar los primeros prompts para que empiece a programar la aplicación de forma determinística y ordenada.

---

## 📋 Prerequisitos

### 1. Ya Tienes
- ✅ Repo de GitHub creado
- ✅ Carpeta `/docs` con documentación
- ✅ Cursor instalado y conectado al repo

### 2. Estructura Actual del Repo

```
tu-repo/
├── docs/
│   ├── technical-product-overview.md
│   ├── brd.md
│   ├── erd-improved-complete.mmd
│   ├── erd-simplified.mmd
│   ├── schema.prisma
│   └── ... (otros docs generados)
├── .git/
└── README.md (?)
```

---

## 🔧 Configuración de Cursor

### Paso 1: Configurar `.cursorrules`

Crea este archivo en la raíz del repo:

```bash
# .cursorrules
# Construction ERP-Lite - Cursor AI Rules

## Project Context
This is a multi-tenant SaaS platform for construction project management.

## Tech Stack
- Framework: Next.js 15 (App Router)
- Language: TypeScript 5.3+
- Database: PostgreSQL (Neon)
- ORM: Prisma 5.x
- Styling: TailwindCSS 4 + shadcn/ui
- Auth: next-auth v5
- Jobs: Inngest
- Storage: Cloudflare R2
- Deploy: Vercel

## Code Style
- Use TypeScript strict mode
- Prefer async/await over promises
- Use Zod for validation
- Follow Airbnb style guide
- Use functional components (React)

## File Naming
- Components: PascalCase (Button.tsx)
- Utilities: camelCase (formatDate.ts)
- Server Actions: camelCase with .action.ts suffix
- API Routes: route.ts (Next.js convention)

## Database Rules
- NEVER use float for money/quantities (use Decimal)
- ALWAYS enforce tenant isolation (orgId in queries)
- Use transactions for multi-table operations
- Soft delete for financial records (deleted: true)
- Use idempotency keys for critical operations

## Security
- Never expose orgId in URLs (derive server-side)
- Validate all inputs with Zod
- Use Server Actions for mutations
- Implement Row Level Security mindset

## Documentation
- All docs are in /docs folder
- ERD: docs/erd-improved-complete.mmd
- Schema: docs/schema.prisma
- Tech Overview: docs/technical-product-overview.md

## Critical Principles
1. Financial correctness over convenience
2. Append-only for certifications/inventory
3. Derived totals (never edit calculated values)
4. Immutability for certified data
5. Multi-tenant isolation is NON-NEGOTIABLE

## When in doubt
- Check docs/brd.md for business requirements
- Check docs/schema.prisma for data model
- Ask before making architectural decisions
```

### Paso 2: Configurar Settings (⌘ + ,)

En Cursor Settings:

```json
{
  "cursor.ai.model": "claude-3.5-sonnet",
  "cursor.ai.temperature": 0.2,
  "cursor.ai.maxTokens": 4000,
  
  // Habilitar composer
  "cursor.composer.enabled": true,
  
  // Indizar docs
  "cursor.codebase.indexDocs": true,
  "cursor.codebase.include": [
    "**/*.ts",
    "**/*.tsx",
    "**/*.md",
    "**/*.prisma"
  ]
}
```

### Paso 3: Indizar el Codebase

1. Abrir Command Palette (⌘ + Shift + P)
2. Buscar: "Cursor: Index Codebase"
3. Esperar a que termine (indexará los docs también)

---

## 💬 Cómo Interactuar con Cursor

### Tipos de Prompts

#### 1. Composer (⌘ + I) - Para Tareas Grandes

Usar para:
- Crear múltiples archivos relacionados
- Implementar features completas
- Refactors grandes

**Ejemplo:**
```
Setup the Turborepo monorepo structure with:
- apps/web (Next.js 15)
- packages/database (Prisma)
- packages/validators (Zod)
- packages/ui (shadcn)

Follow the structure in docs/step2-tech-stack.md
```

#### 2. Chat (⌘ + L) - Para Consultas y Planeación

Usar para:
- Preguntas sobre arquitectura
- Planear implementaciones
- Debugging
- Explicaciones de código

**Ejemplo:**
```
How should I implement RBAC middleware in Next.js App Router 
to enforce organization-level permissions? 

Refer to the OrgMember roles in docs/schema.prisma
```

#### 3. Inline Edit (⌘ + K) - Para Ediciones Específicas

Usar para:
- Modificar función específica
- Agregar validación
- Fix bugs puntuales

**Ejemplo (con código seleccionado):**
```
Add Zod validation to ensure orgId is always present 
and total is a valid Decimal
```

---

## 🎯 Estrategia de Prompting

### Principio: Incremental y Determinístico

**NO hacer:**
```
❌ "Create the entire Construction ERP app"
❌ "Build everything from the ERD"
❌ "Implement all features"
```

**SÍ hacer:**
```
✅ "Setup monorepo structure (Phase 0)"
✅ "Implement Organization + User models with Prisma"
✅ "Create auth flow with next-auth v5"
```

### Template de Prompt Efectivo

```
**Goal:** [What you want to achieve]

**Context:** 
- [Reference to docs if needed]
- [Current state]

**Requirements:**
1. [Specific requirement 1]
2. [Specific requirement 2]
3. [Specific requirement 3]

**Files to create/modify:**
- [file1.ts]
- [file2.tsx]

**Acceptance criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

**Don't:**
- [Thing to avoid]
```

**Ejemplo Real:**
```
**Goal:** Setup Prisma in packages/database

**Context:**
- Monorepo already exists
- Schema is in docs/schema.prisma
- Using Neon PostgreSQL

**Requirements:**
1. Copy schema to packages/database/prisma/schema.prisma
2. Add scripts to package.json (generate, push, studio, migrate)
3. Create client.ts with singleton pattern
4. Create index.ts that exports prisma client

**Files to create:**
- packages/database/prisma/schema.prisma
- packages/database/src/client.ts
- packages/database/src/index.ts
- packages/database/package.json
- packages/database/tsconfig.json

**Acceptance criteria:**
- [ ] Schema has all 57 tables
- [ ] Prisma client is a singleton
- [ ] Can run `pnpm db:generate` successfully
- [ ] TypeScript types are generated

**Don't:**
- Change the schema (use exactly as in docs)
- Add unnecessary dependencies
```

---

## 📚 Usar la Documentación

### Referenciar Docs en Prompts

Cursor puede leer los archivos en `/docs`. Referenciálos así:

```
According to docs/schema.prisma, the Organization model has...

Following the structure in docs/step2-tech-stack.md, create...

Implement the Party model as defined in docs/erd-improved-complete.mmd...
```

### Agregar Context con @

Puedes mencionar archivos específicos:

```
@docs/schema.prisma 

Create the Prisma client wrapper following best practices
```

---

## 🚀 Fases de Implementación Recomendadas

### Phase 0: Setup (1 prompt)
```
**Goal:** Initialize Turborepo monorepo

**Prompt:**
Setup Turborepo monorepo with structure from @docs/step2-tech-stack.md:

Structure:
- apps/web (Next.js 15)
- packages/database (empty for now)
- packages/validators (empty for now)  
- packages/ui (empty for now)
- tooling/eslint
- tooling/typescript

Create root package.json with workspaces and turbo.json config.
Use pnpm as package manager.

Files to create:
- package.json (root)
- turbo.json
- pnpm-workspace.yaml
- .gitignore
- apps/web/package.json
- packages/*/package.json

Don't:
- Install dependencies yet
- Create actual code files
```

### Phase 1: Database Setup (2-3 prompts)

**Prompt 1.1: Prisma Package**
```
**Goal:** Setup Prisma in packages/database

**Context:**
- Schema is at @docs/schema.prisma (57 tables)
- Using Neon PostgreSQL
- Must support multiple schemas (public, finance, inventory, quality)

**Requirements:**
1. Copy exact schema from docs (don't modify)
2. Create client singleton
3. Setup package.json scripts
4. Export Prisma types

**Files to create:**
- packages/database/prisma/schema.prisma (copy from docs)
- packages/database/src/client.ts
- packages/database/src/index.ts
- packages/database/package.json
- packages/database/tsconfig.json
- packages/database/.env.example

**Acceptance criteria:**
- [ ] Schema has all models (Organization, User, Project, etc.)
- [ ] Client is singleton pattern
- [ ] Scripts: db:generate, db:push, db:studio, db:migrate
- [ ] TypeScript strict mode

**Don't:**
- Modify the schema
- Add seed data yet
```

**Prompt 1.2: Validators Package**
```
**Goal:** Create Zod validators package

**Requirements:**
1. Setup validators package structure
2. Create auth schemas (login, register)
3. Create organization schemas (create, update)
4. Export all schemas from index

**Files to create:**
- packages/validators/src/auth.ts
- packages/validators/src/organization.ts
- packages/validators/src/index.ts
- packages/validators/package.json
- packages/validators/tsconfig.json

**Schemas needed:**
- loginSchema (email, password)
- registerSchema (email, password, fullName, orgName)
- createOrganizationSchema (name, taxId, country)

Use Zod v3 and export both schemas and inferred types.
```

### Phase 2: Next.js App (3-4 prompts)

**Prompt 2.1: Next.js Setup**
```
**Goal:** Setup Next.js 15 app with auth

**Context:**
- Using App Router
- Auth with next-auth v5
- TailwindCSS + shadcn/ui

**Requirements:**
1. Initialize Next.js 15 in apps/web
2. Setup TailwindCSS
3. Configure next-auth with Prisma adapter
4. Create basic app structure

**Files to create:**
- apps/web/app/layout.tsx
- apps/web/app/page.tsx
- apps/web/lib/auth.ts
- apps/web/tailwind.config.ts
- apps/web/next.config.js
- apps/web/.env.example

**Acceptance criteria:**
- [ ] Next.js 15 with App Router
- [ ] TailwindCSS working
- [ ] next-auth configured (no routes yet)
- [ ] Can import @repo/database

**Don't:**
- Create auth routes yet
- Add shadcn components yet
```

**Prompt 2.2: Auth Pages**
```
**Goal:** Create authentication pages

**Requirements:**
1. Login page with email/password
2. Register page (user + creates org)
3. Auth middleware for protected routes
4. Session handling

**Files to create:**
- apps/web/app/(auth)/login/page.tsx
- apps/web/app/(auth)/register/page.tsx
- apps/web/app/(auth)/layout.tsx
- apps/web/middleware.ts
- apps/web/app/api/auth/[...nextauth]/route.ts

Use @repo/validators for form validation.
Redirect authenticated users to /dashboard.

**Don't:**
- Create dashboard yet
- Add OAuth providers (later)
```

### Phase 3: Core Features (Multiple prompts)

Continuar con prompts específicos para:
- Dashboard
- Organizations CRUD
- Projects CRUD
- WBS structure
- Budget management
- Etc.

---

## 🎨 Patrones de Código a Seguir

### 1. Server Actions Pattern

```typescript
// apps/web/app/actions/projects.ts
'use server'

import { z } from 'zod'
import { prisma } from '@repo/database'
import { getSession } from '@/lib/auth'

const createProjectSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().optional(),
})

export async function createProject(data: z.infer<typeof createProjectSchema>) {
  const session = await getSession()
  if (!session?.user?.id) throw new Error('Unauthorized')
  
  // Get orgId server-side (NEVER from client)
  const orgMember = await prisma.orgMember.findFirst({
    where: { userId: session.user.id, active: true },
  })
  
  if (!orgMember) throw new Error('No active organization')
  
  // Validate
  const validated = createProjectSchema.parse(data)
  
  // Create with transaction
  return await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...validated,
        orgId: orgMember.orgId,
        projectNumber: await generateProjectNumber(orgMember.orgId),
        createdByOrgMemberId: orgMember.id,
      },
    })
    
    // Add creator as project member
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        orgMemberId: orgMember.id,
        projectRole: 'MANAGER',
      },
    })
    
    return project
  })
}
```

### 2. RBAC Middleware Pattern

```typescript
// apps/web/lib/rbac.ts
import { getSession } from './auth'
import { prisma } from '@repo/database'

export async function requireRole(minRole: OrgRole) {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  
  const member = await prisma.orgMember.findFirst({
    where: { 
      userId: session.user.id,
      active: true,
    },
  })
  
  if (!member) throw new Error('No organization')
  
  const roleHierarchy = ['VIEWER', 'ACCOUNTANT', 'EDITOR', 'ADMIN', 'OWNER']
  const userLevel = roleHierarchy.indexOf(member.role)
  const requiredLevel = roleHierarchy.indexOf(minRole)
  
  if (userLevel < requiredLevel) {
    throw new Error('Insufficient permissions')
  }
  
  return { orgId: member.orgId, orgMemberId: member.id, role: member.role }
}
```

---

## ✅ Checklist: Antes de Empezar con Cursor

- [ ] `.cursorrules` creado en raíz
- [ ] Cursor settings configurados
- [ ] Codebase indexado
- [ ] Docs folder tiene todos los archivos necesarios
- [ ] Git repo conectado
- [ ] .env.example con DATABASE_URL placeholder

---

## 🎯 Primer Prompt Sugerido

Cuando estés listo, usa este prompt en Composer (⌘ + I):

```
**Goal:** Setup Turborepo monorepo structure

**Context:**
Following the architecture defined in @docs/step2-tech-stack.md, 
initialize a Turborepo monorepo for the Construction ERP project.

**Requirements:**

1. Create root configuration:
   - package.json with workspaces
   - turbo.json with pipeline config
   - pnpm-workspace.yaml
   - .gitignore (node_modules, .env*, .next, etc)

2. Create workspace structure:
   - apps/web (placeholder)
   - packages/database (placeholder)
   - packages/validators (placeholder)
   - packages/ui (placeholder)
   - tooling/typescript (shared tsconfig)

3. Root package.json should have:
   - Scripts: dev, build, lint, format
   - DevDependencies: turbo, prettier, typescript
   - PackageManager: "pnpm@9.1.0"
   - Engines: node >=20

4. turbo.json should define tasks:
   - build (depends on ^build)
   - dev (cache: false, persistent: true)
   - lint
   - db:generate (cache: false)

**Files to create:**
- /package.json
- /turbo.json
- /pnpm-workspace.yaml
- /.gitignore
- /.prettierrc
- /apps/web/package.json
- /packages/database/package.json
- /packages/validators/package.json
- /packages/ui/package.json
- /tooling/typescript/base.json
- /tooling/typescript/nextjs.json
- /tooling/typescript/react-library.json

**Acceptance criteria:**
- [ ] pnpm install works
- [ ] Directory structure matches docs/step2-tech-stack.md
- [ ] turbo.json has correct pipeline
- [ ] All workspace packages referenced

**Don't:**
- Install framework dependencies yet (Next.js, Prisma, etc)
- Create actual source files
- Setup .env files
```

---

## 📊 Resumen

1. **Configurar** `.cursorrules` con reglas del proyecto
2. **Indizar** el codebase (incluye `/docs`)
3. **Usar** prompts incrementales y específicos
4. **Referenciar** docs con `@docs/filename.md`
5. **Seguir** el orden de fases (0 → 1 → 2 → 3)
6. **Validar** cada paso antes de continuar

**Regla de oro:** Un prompt = Un PR. Cada prompt debe producir cambios que se puedan commitear independientemente.

---

## 🚀 ¿Listo?

Una vez que tengas `.cursorrules` y settings configurados, copia el "Primer Prompt Sugerido" arriba en Cursor Composer y empieza!

Después de cada fase exitosa, vuelve aquí para el siguiente prompt.
