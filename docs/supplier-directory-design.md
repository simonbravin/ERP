# ERD: Adición de Directorio Global de Proveedores

## 🆕 Nuevas Tablas (Schema: public)

### 1. GlobalParty (Proveedor Global)

```prisma
model GlobalParty {
  id                String   @id @default(uuid())
  name              String   // "CEMEX", "Hilti", etc
  legalName         String?  @map("legal_name")
  taxId             String?  @map("tax_id")
  email             String?
  phone             String?
  website           String?
  logo              String?  // URL to logo
  
  // Clasificación
  category          String   // "CONCRETE_SUPPLIER|TOOL_MANUFACTURER|etc"
  subcategories     String[] // Array: ["READY_MIX", "CEMENT"]
  
  // Verificación
  verified          Boolean  @default(false)
  verifiedAt        DateTime? @map("verified_at")
  verifiedBy        String?  @map("verified_by") // Staff user ID
  
  // Coverage
  countries         String[] // ["US", "MX", "PE"]
  regions           String[] // ["California", "CDMX"]
  
  // Metadata
  description       String?
  certifications    Json     @default("[]") // ["ISO9001", "LEED"]
  specialties       Json     @default("[]")
  metadata          Json     @default("{}")
  
  // Stats (computed)
  avgRating         Decimal? @map("avg_rating") @db.Decimal(3, 2)
  reviewCount       Int      @default(0) @map("review_count")
  orgCount          Int      @default(0) @map("org_count") // How many orgs use this
  
  active            Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  contacts          GlobalPartyContact[]
  orgLinks          OrgPartyLink[]
  products          GlobalProduct[]
  claims            GlobalPartyClaim[]
  reviews           GlobalPartyReview[]

  @@index([category])
  @@index([verified])
  @@index([name])
  @@map("global_parties")
  @@schema("public")
}
```

### 2. GlobalPartyContact

```prisma
model GlobalPartyContact {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  fullName      String   @map("full_name")
  role          String?
  email         String?
  phone         String?
  region        String?  // Regional contact
  isPrimary     Boolean  @default(false) @map("is_primary")
  createdAt     DateTime @default(now()) @map("created_at")

  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id], onDelete: Cascade)

  @@index([globalPartyId])
  @@map("global_party_contacts")
  @@schema("public")
}
```

### 3. OrgPartyLink (Link Org → Global)

```prisma
model OrgPartyLink {
  id                String   @id @default(uuid())
  orgId             String   @map("org_id")
  globalPartyId     String   @map("global_party_id")
  
  // Local overrides
  localAlias        String?  @map("local_alias") // "CEMEX Local" vs official "CEMEX"
  localContactName  String?  @map("local_contact_name")
  localContactEmail String?  @map("local_contact_email")
  localContactPhone String?  @map("local_contact_phone")
  
  // Relationship
  preferred         Boolean  @default(false) // Proveedor preferido
  status            String   @default("ACTIVE") // ACTIVE|INACTIVE|BLOCKED
  paymentTerms      String?  @map("payment_terms") // "Net 30"
  discount          Decimal? @db.Decimal(5, 2) // Descuento negociado %
  
  // Notes
  notes             String?
  internalCode      String?  @map("internal_code") // Código interno del org
  
  // Stats
  totalOrders       Int      @default(0) @map("total_orders")
  totalSpent        Decimal  @default(0) @map("total_spent") @db.Decimal(15, 2)
  lastOrderDate     DateTime? @map("last_order_date")
  
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  globalParty  GlobalParty  @relation(fields: [globalPartyId], references: [id])

  @@unique([orgId, globalPartyId])
  @@index([orgId, preferred])
  @@map("org_party_links")
  @@schema("public")
}
```

### 4. GlobalPartyClaim (Reclamo de Ficha)

```prisma
model GlobalPartyClaim {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  
  // Claimant info
  claimantName  String   @map("claimant_name")
  claimantEmail String   @map("claimant_email")
  claimantRole  String   @map("claimant_role") // "Owner", "Manager"
  
  // Verification
  status        String   @default("PENDING") // PENDING|VERIFIED|REJECTED
  verificationToken String? @unique @map("verification_token")
  verificationDocs  String[] @map("verification_docs") // URLs to docs
  
  // Review
  reviewedBy    String?  @map("reviewed_by") // Staff user ID
  reviewedAt    DateTime? @map("reviewed_at")
  reviewNotes   String?  @map("review_notes")
  
  createdAt     DateTime @default(now()) @map("created_at")

  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id])

  @@index([globalPartyId])
  @@index([status])
  @@map("global_party_claims")
  @@schema("public")
}
```

### 5. GlobalPartyReview (Ratings)

```prisma
model GlobalPartyReview {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  orgId         String   @map("org_id")
  orgMemberId   String   @map("org_member_id")
  
  // Rating
  rating        Int      // 1-5 stars
  title         String?
  review        String?
  
  // Categories (optional detailed ratings)
  qualityRating Int?     @map("quality_rating")
  deliveryRating Int?    @map("delivery_rating")
  priceRating   Int?     @map("price_rating")
  serviceRating Int?     @map("service_rating")
  
  // Verification
  verified      Boolean  @default(false) // Org actually used this supplier
  orderIds      String[] @map("order_ids") // Related commitment IDs
  
  status        String   @default("PUBLISHED") // PUBLISHED|FLAGGED|REMOVED
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id])

  @@unique([globalPartyId, orgId]) // One review per org
  @@index([globalPartyId, status])
  @@map("global_party_reviews")
  @@schema("public")
}
```

### 6. GlobalProduct (Catálogo Global - Opcional)

```prisma
model GlobalProduct {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  
  sku           String   // SKU del proveedor
  name          String
  description   String?
  category      String
  unit          String   // "m3", "ton", "unit"
  
  // Pricing (reference)
  referencePriceMin Decimal? @map("reference_price_min") @db.Decimal(15, 2)
  referencePriceMax Decimal? @map("reference_price_max") @db.Decimal(15, 2)
  currency      String   @default("USD")
  
  // Specs
  specifications Json    @default("{}")
  certifications String[]
  
  // Images
  imageUrl      String?  @map("image_url")
  datasheetUrl  String?  @map("datasheet_url")
  
  active        Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id])

  @@unique([globalPartyId, sku])
  @@index([category])
  @@map("global_products")
  @@schema("public")
}
```

---

## 🔄 Cambios a Tablas Existentes

### Party (existente) - Renombrar a LocalParty (Opcional)

```diff
model Party {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  partyType   String   @map("party_type")
+ sourceType  String   @default("LOCAL") @map("source_type") // LOCAL|GLOBAL_LINKED
+ globalPartyId String? @map("global_party_id") // FK to GlobalParty
  name        String
  // ... rest stays same
  
+ // Relation
+ globalParty GlobalParty? @relation(fields: [globalPartyId], references: [id])
}
```

**Alternativa más limpia:** Mantener `Party` como está, usar solo `OrgPartyLink` como intermediario.

---

## 🎯 Flujos de Usuario

### Flujo 1: Crear Proveedor desde Global

```
1. User va a "Proveedores"
2. Click "Agregar Proveedor"
3. Busca en directorio global: "CEMEX"
4. Selecciona "CEMEX México"
5. Sistema crea OrgPartyLink
6. User agrega contacto local (vendedor CEMEX de su ciudad)
7. Guarda con alias local "CEMEX CDMX"
```

### Flujo 2: Crear Proveedor Local

```
1. User busca "Ferretería del barrio"
2. No existe en global
3. Click "Crear proveedor local"
4. Llena form básico
5. Guarda como Party (local)
```

### Flujo 3: Claim de Proveedor (Futuro)

```
1. CEMEX rep visita tu plataforma
2. Busca "CEMEX" en directory
3. Click "Claim this listing"
4. Provee docs (business license, etc)
5. Staff verifica
6. Ahora CEMEX puede:
   - Actualizar info
   - Responder reviews
   - Agregar productos
```

---

## 📊 UI/UX Propuesta

### Página: Proveedores

```
┌────────────────────────────────────────────────┐
│ 🔍 Buscar proveedores...        [+ Nuevo]     │
├────────────────────────────────────────────────┤
│ Filtros:                                       │
│ ☐ Solo mis proveedores   ☐ Directorio global │
│ Categoría: [Todos ▼]     País: [Todos ▼]     │
├────────────────────────────────────────────────┤
│                                                │
│ 🌎 CEMEX                           ⭐ 4.7     │
│    Concrete Supplier • Global                 │
│    📍 MX, US, PE | ✓ Verified                │
│    [En mis proveedores] [+ Agregar]           │
│                                                │
│ 🏢 Ferretería López                            │
│    Hardware Store • Local                      │
│    📍 Ciudad de México                         │
│    [Ver detalles]                              │
│                                                │
└────────────────────────────────────────────────┘
```

### Modal: Agregar Proveedor Global

```
┌────────────────────────────────────────────────┐
│ Agregar CEMEX a mis proveedores               │
├────────────────────────────────────────────────┤
│ Alias local (opcional):                        │
│ [CEMEX CDMX                      ]            │
│                                                │
│ Contacto local:                                │
│ Nombre:  [Juan Pérez            ]            │
│ Email:   [juan@cemex.com        ]            │
│ Teléfono: [+52 55 1234 5678     ]            │
│                                                │
│ Términos de pago:                              │
│ [Net 30                          ]            │
│                                                │
│ ☑ Marcar como proveedor preferido             │
│                                                │
│ Notas internas:                                │
│ [Descuento 5% en pedidos >$10k  ]            │
│                                                │
│           [Cancelar]  [Agregar] ✓             │
└────────────────────────────────────────────────┘
```

---

## 🔮 Preparación para Contabilidad/Facturación

### Estructura Futura (Schema: accounting)

```prisma
// FASE FUTURA: Contabilidad
model AccountingAccount {
  id              String @id
  orgId           String
  accountNumber   String // "1.1.01.001"
  accountName     String // "Caja Chica"
  accountType     String // ASSET|LIABILITY|EQUITY|INCOME|EXPENSE
  parentId        String?
  balance         Decimal
  currency        String
  // ...
}

model JournalEntry {
  id              String @id
  orgId           String
  entryNumber     String
  date            DateTime
  description     String
  status          String // DRAFT|POSTED|VOID
  lines           JournalEntryLine[]
  // Link to source transaction
  sourceType      String? // FINANCE_TRANSACTION|PAYMENT|CERTIFICATION
  sourceId        String?
}

model JournalEntryLine {
  id              String @id
  journalEntryId  String
  accountId       String
  debit           Decimal
  credit          Decimal
  // ...
}

// FASE FUTURA: Facturación Electrónica
model Invoice {
  id              String @id
  orgId           String
  invoiceType     String // SALES|PURCHASE
  partyId         String
  legalSeries     String // "A", "B" (Argentina/México)
  legalNumber     String // 00001234
  fiscalStatus    String // PENDING|STAMPED|CANCELLED
  
  // CFDi (México)
  cfdiUuid        String?
  cfdiXml         String?
  satStatus       String?
  
  // AFIP (Argentina)
  cae             String?
  caeExpiration   DateTime?
  
  // Amounts
  subtotal        Decimal
  tax             Decimal
  total           Decimal
  
  stampedAt       DateTime?
  cancelledAt     DateTime?
}
```

**Relaciones con sistema actual:**
- `FinanceTransaction` → genera `Invoice` cuando se "timbra"
- `Invoice` → genera `JournalEntry` automáticamente
- `Party` / `GlobalParty` → linked to `Invoice.partyId`

---

## 📝 Cambios Necesarios a Documentación

### 1. ERD Completo Actualizado

Agregar:
- 6 nuevas tablas globales
- Relaciones Party → GlobalParty
- Schema accounting (placeholder)

### 2. Prisma Schema Actualizado

Agregar modelos completos de:
- GlobalParty
- GlobalPartyContact
- OrgPartyLink
- GlobalPartyClaim
- GlobalPartyReview
- GlobalProduct

### 3. BRD Actualizado

Nueva sección:
```markdown
## 4.X Directorio Global de Proveedores

### Objetivos
- Reducir duplicación de proveedores
- Mejorar calidad de datos
- Crear network effects
- Preparar marketplace futuro

### Features
- Directorio global verificado
- Link org → global supplier
- Local overrides (contactos, términos)
- Rating & reviews
- Claim de proveedores
- Catálogo de productos (opcional)

### Fases
- MVP: GlobalParty + OrgPartyLink
- v2: Claims + Verification
- v3: Reviews + Ratings
- v4: Product catalog
- v5: Marketplace
```

### 4. Tech Stack

Agregar consideraciones:
- Search engine (Algolia / Typesense) para búsqueda de proveedores
- Image hosting para logos (Cloudflare Images)
- Verification workflow para claims

---

## ✅ Recomendación Final

**SÍ, implementar directorio global de proveedores**, pero en fases:

### MVP (Ahora)
- [x] GlobalParty (básico)
- [x] OrgPartyLink
- [x] Mantener Party local
- [x] UI: search + link

### Phase 2 (Q3 2025)
- [ ] GlobalPartyClaim
- [ ] Verification workflow
- [ ] Staff admin panel

### Phase 3 (Q4 2025)
- [ ] GlobalPartyReview
- [ ] Rating system
- [ ] Public profiles

### Phase 4 (2026)
- [ ] GlobalProduct catalog
- [ ] Price comparison
- [ ] RFQ system

### Phase 5 (Future)
- [ ] Marketplace
- [ ] Direct ordering
- [ ] Integrations con ERPs de proveedores

---

## 🚀 Próximo Paso

¿Quieres que genere:
1. **ERD actualizado completo** con proveedores globales?
2. **Prisma schema actualizado** con todos los modelos?
3. **Documentación revisada** (BRD, roadmap, etc)?

Dime y lo genero inmediatamente! 🎉
