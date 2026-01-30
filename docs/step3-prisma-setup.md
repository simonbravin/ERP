# PASO 3: Prisma Schema - Resumen y Setup

## ✅ Schema Generado

**Archivo:** `schema.prisma`
**Total de modelos:** 51
**Schemas PostgreSQL:** 4 (public, finance, inventory, quality)

---

## 📊 Resumen de Modelos por Módulo

### CORE (14 modelos)
- Organization, OrgProfile
- User, OrgMember, Session
- ModuleActivation, ApiKey, RefreshToken
- IdempotencyKey, AuditLog
- CustomFieldDefinition, CustomFieldValue
- WorkflowDefinition, WorkflowInstance, WorkflowApproval

### PROJECTS (3 modelos)
- Project, ProjectMember
- WbsNode

### BUDGET (5 modelos)
- BudgetVersion, BudgetLine, BudgetResource
- ChangeOrder, ChangeOrderLine

### PARTIES (2 modelos)
- Party, PartyContact

### FINANCE (5 modelos - schema: finance)
- Currency, ExchangeRate
- FinanceTransaction, FinanceLine, Payment
- OverheadAllocation

### COMMITMENTS (2 modelos)
- Commitment, CommitmentLine

### CERTIFICATIONS (2 modelos)
- Certification, CertificationLine

### INVENTORY (3 modelos - schema: inventory)
- InventoryItem, InventoryLocation, InventoryMovement

### QUALITY (4 modelos - schema: quality)
- RFI, RFIComment
- Submittal
- Inspection, InspectionItem

### DOCUMENTS (3 modelos)
- Document, DocumentVersion, DocumentLink

### TEMPLATES & EXPORTS (2 modelos)
- Template, ExportRun

### REPORTING (2 modelos)
- SavedReport, SavedReportRun

### SCHEDULING (2 modelos)
- ScheduleTask, ProgressUpdate

### DAILY REPORTS (4 modelos)
- DailyReport, DailyReportLabor, DailyReportEquipment, DailyReportPhoto
- SiteLogEntry (legacy)

### EVENTS (3 modelos)
- OutboxEvent, WebhookEndpoint, WebhookDelivery

### NOTIFICATIONS (1 modelo)
- Notification

---

## 🎯 Features Implementadas en el Schema

### ✅ Multi-Tenancy
- Tenant isolation via `orgId`
- Row Level Security ready
- Deny-by-default enforcement

### ✅ Extensibilidad
- Custom Fields (any entity)
- JSONB metadata (WbsNode, BudgetResource, Party, etc)
- Workflow definitions (JSON steps)

### ✅ Multi-Currency
- Currency master table
- ExchangeRate historical tracking
- Snapshot de rates en transacciones

### ✅ Audit Trail
- AuditLog con before/after snapshots
- Actor tracking (who did what when)
- Request correlation IDs

### ✅ Immutability
- Certifications locked when ISSUED
- Integrity seal (SHA-256)
- Soft delete on financial data

### ✅ Idempotency
- IdempotencyKey table
- Inventory movements idempotent
- Payment operations idempotent

### ✅ Versioning
- Documents versioned
- Budget versions
- Submittal revisions

### ✅ Workflows
- Configurable approval chains
- Change order approvals
- Budget approvals

---

## 🔧 Setup Instructions

### 1. Copiar schema a proyecto

```bash
# En tu monorepo
cp schema.prisma packages/database/prisma/schema.prisma
```

### 2. Instalar dependencias

```bash
cd packages/database
pnpm add @prisma/client
pnpm add -D prisma
```

### 3. Setup database (Neon)

```bash
# 1. Crear cuenta en Neon: https://neon.tech
# 2. Crear nuevo proyecto: "construction-erp-dev"
# 3. Copiar connection string
```

### 4. Configurar .env

```bash
# packages/database/.env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
DIRECT_URL="postgresql://user:pass@host/db?sslmode=require"
```

**Nota:** En Neon, `DIRECT_URL` es necesario para migrations (bypasses pooler).

### 5. Crear schemas en PostgreSQL

```sql
-- Conectar a tu DB y ejecutar:
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS quality;
```

**O usar migration inicial:**

```bash
# packages/database/prisma/migrations/0_init/migration.sql
CREATE SCHEMA IF NOT EXISTS finance;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS quality;
```

### 6. Generate Prisma Client

```bash
cd packages/database
pnpm prisma generate
```

### 7. Crear primera migration

```bash
pnpm prisma migrate dev --name init
```

Esto creará:
- `prisma/migrations/xxxxxxx_init/migration.sql`
- Todas las 51 tablas
- Todos los índices
- Todas las relaciones (FKs)

### 8. Seed data (opcional)

```typescript
// packages/database/src/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Seed currencies
  await prisma.currency.createMany({
    data: [
      { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalPlaces: 2 },
      { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', decimalPlaces: 2 },
      { code: 'COP', name: 'Colombian Peso', symbol: '$', decimalPlaces: 2 },
      { code: 'CLP', name: 'Chilean Peso', symbol: '$', decimalPlaces: 0 },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Currencies seeded')

  // Seed test organization
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Construction Co.',
      slug: 'demo-construction',
      taxId: 'TAX-12345',
      country: 'US',
      active: true,
      profile: {
        create: {
          legalName: 'Demo Construction Company LLC',
          baseCurrency: 'USD',
          defaultTaxPct: 21.0,
          email: 'contact@demo.com',
        },
      },
    },
  })

  console.log('✅ Demo organization created:', org.id)

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      fullName: 'Admin User',
      passwordHash: '$2a$10$...', // Use bcrypt in real app
      active: true,
      memberships: {
        create: {
          orgId: org.id,
          role: 'OWNER',
          active: true,
        },
      },
    },
  })

  console.log('✅ Admin user created:', adminUser.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Run seed:
```bash
pnpm prisma db seed
```

---

## 📦 Package Structure

```
packages/database/
├── prisma/
│   ├── schema.prisma          # ← Tu schema completo
│   ├── migrations/
│   │   └── xxxxxxx_init/
│   │       └── migration.sql
│   └── seed.ts
│
├── src/
│   ├── index.ts               # Export PrismaClient
│   ├── client.ts              # Singleton instance
│   └── types.ts               # Re-export Prisma types
│
├── .env
├── package.json
└── tsconfig.json
```

### packages/database/src/index.ts
```typescript
export * from '@prisma/client'
export { prisma } from './client'
```

### packages/database/src/client.ts
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### packages/database/package.json
```json
{
  "name": "@repo/database",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx src/seed.ts"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0"
  },
  "devDependencies": {
    "prisma": "^5.10.0",
    "tsx": "^4.7.1"
  }
}
```

---

## 🧪 Testing Schema

### Test connection
```typescript
// test.ts
import { prisma } from '@repo/database'

async function testConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
    
    const orgCount = await prisma.organization.count()
    console.log(`📊 Organizations: ${orgCount}`)
    
    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Connection failed:', error)
  }
}

testConnection()
```

Run:
```bash
tsx test.ts
```

---

## 🔍 Prisma Studio

Explora tu DB visualmente:

```bash
cd packages/database
pnpm prisma studio
```

Abre: http://localhost:5555

---

## 📈 Performance Tips

### 1. Índices críticos
El schema ya incluye todos los índices necesarios:
- FK relations (automatic)
- Lookup fields (slug, email, codes)
- Filter fields (status, type, dates)
- Compound indices donde se necesitan

### 2. Connection pooling (Neon)
```typescript
// Para producción, usar pooled connection
DATABASE_URL="postgresql://user:pass@pooler.region.neon.tech/db?sslmode=require&pgbouncer=true"
```

### 3. Query optimization
```typescript
// ✅ BIEN: Include relaciones necesarias
const project = await prisma.project.findUnique({
  where: { id },
  include: {
    budgetVersions: {
      where: { status: 'APPROVED' },
      take: 1,
      orderBy: { createdAt: 'desc' },
    },
  },
})

// ✗ MAL: Overfetching
const project = await prisma.project.findUnique({
  where: { id },
  include: {
    budgetVersions: {
      include: {
        budgetLines: {
          include: {
            resources: true,
          },
        },
      },
    },
  },
})
```

---

## ✅ Schema Listo

Con esto tienes:
1. ✅ Schema Prisma completo (51 modelos)
2. ✅ Multi-schema support (public, finance, inventory, quality)
3. ✅ Tipos TypeScript generados
4. ✅ Migrations ready
5. ✅ Seed data script
6. ✅ Prisma Client exportable

---

## 🚀 Siguiente Paso

Ahora que tenemos el schema listo, podemos:

1. **Crear el monorepo structure** (Turborepo setup)
2. **Setup Next.js app** (apps/web)
3. **Integrar Prisma Client** en Next.js
4. **Crear primer módulo**: Auth + Organizations

¿Quieres que genere los **prompts de Cursor** para el setup inicial del monorepo?
