# Organización de la Carpeta `/docs`

## 📁 Estructura Recomendada

```
docs/
├── 00-overview/
│   ├── README.md                        # Project overview
│   └── tech-stack.md                    # Tech decisions summary
│
├── 01-architecture/
│   ├── technical-product-overview.md    # ← Existing (actualizar)
│   ├── architecture-improvements.md     # ← Generated today
│   └── tech-stack-final.md             # ← step2-tech-stack.md
│
├── 02-data-model/
│   ├── erd-improved-complete.mmd        # ← Complete ERD (51 tables)
│   ├── erd-simplified.mmd               # ← High-level ERD
│   ├── erd-comparison.md                # ← Before/After analysis
│   └── schema.prisma                    # ← Prisma schema
│
├── 03-business-requirements/
│   ├── brd.md                           # ← Existing (actualizar)
│   └── features-roadmap.md              # ← To create
│
├── 04-implementation/
│   ├── prisma-setup.md                  # ← step3-prisma-setup.md
│   ├── cursor-prompts/                  # ← Prompts por fase
│   │   ├── phase-0-setup.md
│   │   ├── phase-1-auth.md
│   │   ├── phase-2-projects.md
│   │   └── ...
│   └── deployment-guide.md              # ← To create
│
├── 05-api-contracts/
│   └── api-spec.yaml                    # ← OpenAPI spec (futuro)
│
└── 06-guides/
    ├── development-workflow.md
    ├── testing-guide.md
    └── contributing.md
```

---

## 📋 Checklist de Documentos

### ✅ Ya Tienes (actualizar)
- [x] `technical-product-overview.md` → Mover a `01-architecture/`
- [x] `brd.md` → Mover a `03-business-requirements/`

### ✅ Generados Hoy
- [x] `architecture-improvements.md`
- [x] `erd-improved-complete.mmd`
- [x] `erd-simplified.mmd`
- [x] `erd-comparison.md`
- [x] `schema.prisma`
- [x] `step1-erd-validation.md`
- [x] `step2-tech-stack.md`
- [x] `step3-prisma-setup.md`

### 📝 Por Crear
- [ ] `00-overview/README.md` - Project overview
- [ ] `03-business-requirements/features-roadmap.md`
- [ ] `04-implementation/deployment-guide.md`
- [ ] `06-guides/development-workflow.md`

---

## 📄 Archivos a Actualizar

### 1. technical-product-overview.md

**Cambios necesarios:**

```diff
- Backend API: NestJS (REST, OpenAPI)
+ Backend API: Next.js API Routes + Server Actions

- Database: AWS Aurora PostgreSQL
+ Database: Neon PostgreSQL (Serverless)

- Async Jobs: SQS + Workers
+ Async Jobs: Inngest (Serverless)

- Storage: Amazon S3
+ Storage: Cloudflare R2

- Cache / Locks: Redis (ElastiCache)
+ Cache: Vercel Edge Cache (built-in)

- Infra: AWS App Runner
+ Infra: Vercel

# Agregar sección:
## New Features (vs Original)
- Custom Fields System
- Workflow Engine
- Change Order Management
- Multi-Currency Support
- RFI + Submittals
- Enhanced Daily Reports
```

### 2. brd.md

**Cambios necesarios:**

```diff
# Agregar a Features:

4.6.1 Change Orders
- Create change order
- Track cost/time impact
- Approval workflow
- Link to budget version

4.8 Quality Management
- RFI tracking
- Submittal workflow
- Inspection reports

4.9 Custom Fields
- Define custom fields per entity
- Per organization
- No migrations required
```

---

## 🎯 README.md Principal (Nuevo)

Crear en: `docs/00-overview/README.md`

```markdown
# Construction ERP-Lite - Documentation

## 🏗️ Project Overview

Multi-tenant SaaS platform for construction project management.

**Target Users:** Small-to-medium construction companies (10-100 employees)

**Key Differentiators:**
- Simpler than Procore
- LATAM-focused (Spanish, local currencies)
- Affordable pricing ($50-100/user/month)
- Modern tech stack (Next.js, serverless)

---

## 📚 Documentation Index

### 1. Architecture
- [Technical Product Overview](../01-architecture/technical-product-overview.md)
- [Architecture Improvements](../01-architecture/architecture-improvements.md)
- [Tech Stack](../01-architecture/tech-stack-final.md)

### 2. Data Model
- [ERD Complete](../02-data-model/erd-improved-complete.mmd) (51 tables)
- [ERD Simplified](../02-data-model/erd-simplified.mmd) (high-level)
- [ERD Comparison](../02-data-model/erd-comparison.md) (before/after)
- [Prisma Schema](../02-data-model/schema.prisma)

### 3. Business Requirements
- [BRD](../03-business-requirements/brd.md)
- [Features Roadmap](../03-business-requirements/features-roadmap.md)

### 4. Implementation
- [Prisma Setup](../04-implementation/prisma-setup.md)
- [Cursor Prompts](../04-implementation/cursor-prompts/)
- [Deployment Guide](../04-implementation/deployment-guide.md)

---

## 🚀 Quick Start

### For Developers

1. Read [Tech Stack](../01-architecture/tech-stack-final.md)
2. Setup database: [Prisma Setup](../04-implementation/prisma-setup.md)
3. Follow [Development Workflow](../06-guides/development-workflow.md)

### For PMs

1. Read [BRD](../03-business-requirements/brd.md)
2. Review [Features Roadmap](../03-business-requirements/features-roadmap.md)
3. Understand [ERD Simplified](../02-data-model/erd-simplified.mmd)

---

## 📊 Project Stats

- **Total Tables:** 51
- **Modules:** 14
- **Tech Stack:** Next.js + Prisma + PostgreSQL + Vercel
- **Target Launch:** Q2 2025

---

## 🔗 External Resources

- [Live App](https://construction-erp.vercel.app) (coming soon)
- [Design System](https://storybook.construction-erp.vercel.app) (coming soon)
- [API Docs](https://api.construction-erp.com/docs) (coming soon)
```

---

## 📊 Features Roadmap (Nuevo)

Crear en: `docs/03-business-requirements/features-roadmap.md`

```markdown
# Features Roadmap

## MVP (Phase 1) - Q2 2025

### Core Features
- [x] Organizations + Multi-tenancy
- [x] User Management + RBAC
- [x] Projects
- [ ] WBS / Budget
- [ ] Budget Versioning
- [ ] Expenses + Income
- [ ] Certifications (basic)
- [ ] Documents
- [ ] Basic Reports

**Target:** Construction companies managing 1-10 projects

---

## Phase 2 - Q3 2025

### Advanced Features
- [ ] Change Orders
- [ ] RFIs
- [ ] Submittals
- [ ] Inventory Management
- [ ] Commitments (POs)
- [ ] Multi-Currency
- [ ] Custom Fields

**Target:** Companies with complex projects, multiple currencies

---

## Phase 3 - Q4 2025

### Quality & Collaboration
- [ ] Workflow Engine (approvals)
- [ ] Daily Reports (enhanced)
- [ ] Inspections
- [ ] Schedule (Gantt)
- [ ] Mobile App (read-only)

**Target:** Teams needing mobile access, quality tracking

---

## Phase 4 - 2026

### Integrations & Advanced
- [ ] QuickBooks integration
- [ ] Procore import
- [ ] API público
- [ ] Time tracking
- [ ] Equipment management
- [ ] Advanced scheduling (critical path)

---

## Not Planned (Out of Scope)

- ❌ Payroll
- ❌ Full accounting (GL)
- ❌ BIM integration
- ❌ Tax authority integrations
```

---

## ✅ Checklist: Reorganizar Docs

### Paso 1: Crear Estructura
```bash
cd docs
mkdir -p 00-overview 01-architecture 02-data-model 03-business-requirements 04-implementation/cursor-prompts 05-api-contracts 06-guides
```

### Paso 2: Mover Archivos Existentes
```bash
# Mover documentos originales
mv technical-product-overview.md 01-architecture/
mv brd.md 03-business-requirements/

# Mover documentos generados hoy
mv architecture-improvements.md 01-architecture/
mv step2-tech-stack.md 01-architecture/tech-stack-final.md

mv erd-improved-complete.mmd 02-data-model/
mv erd-simplified.mmd 02-data-model/
mv erd-comparison.md 02-data-model/
mv schema.prisma 02-data-model/

mv step3-prisma-setup.md 04-implementation/prisma-setup.md
```

### Paso 3: Crear Nuevos Archivos
```bash
# README principal
touch 00-overview/README.md

# Features roadmap
touch 03-business-requirements/features-roadmap.md

# Deployment guide
touch 04-implementation/deployment-guide.md

# Development workflow
touch 06-guides/development-workflow.md
touch 06-guides/testing-guide.md
touch 06-guides/contributing.md
```

### Paso 4: Actualizar Archivos
- [ ] Actualizar `technical-product-overview.md` con nuevo stack
- [ ] Actualizar `brd.md` con nuevas features
- [ ] Crear `README.md` principal
- [ ] Crear `features-roadmap.md`

---

## 📝 Git Commit Sugerido

```bash
git add docs/
git commit -m "docs: reorganize documentation structure

- Move existing docs to categorized folders
- Add ERD complete (51 tables) and simplified versions
- Add Prisma schema
- Add architecture improvements analysis
- Add tech stack finalization
- Create README and roadmap
- Update technical overview with new stack decisions
"
```

---

## ✅ Resumen

Ahora tienes:
1. ✅ **Estructura organizada** de documentación
2. ✅ **ERD completo mejorado** (51 tablas)
3. ✅ **Prisma schema** listo para usar
4. ✅ **Tech stack definido** (Next.js full-stack)
5. ✅ **Guías de setup** (Prisma, monorepo)

**Siguiente paso:** Crear prompts de Cursor para implementación fase por fase.
```

---

## 🚀 ¿Listo para el Paso 4?

**Paso 4 será:** Generar prompts de Cursor detallados para cada fase de implementación.

¿Quieres que genere los primeros prompts ahora?
