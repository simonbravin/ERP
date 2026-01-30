# Schema Updates: Global Supplier Directory

## Ubicación en schema.prisma

Estas tablas se insertan después de la sección PARTIES (después de PartyContact).

---

## Nuevos Modelos (6 tablas)

```prisma
// ============================================================
// GLOBAL SUPPLIER DIRECTORY
// ============================================================

model GlobalParty {
  id                String   @id @default(uuid())
  name              String   
  legalName         String?  @map("legal_name")
  taxId             String?  @map("tax_id")
  email             String?
  phone             String?
  website           String?
  logoUrl           String?  @map("logo_url")
  
  // Classification
  category          String   // CONCRETE_SUPPLIER|TOOL_MANUFACTURER|STEEL_SUPPLIER|etc
  subcategories     String[] // ["READY_MIX", "CEMENT"]
  
  // Verification
  verified          Boolean  @default(false)
  verifiedAt        DateTime? @map("verified_at")
  verifiedByStaff   String?  @map("verified_by_staff")
  
  // Coverage
  countries         String[] // ["US", "MX", "PE"]
  regions           String[] // ["California", "CDMX", "Lima"]
  
  // Description & Metadata
  description       String?  @db.Text
  certifications    Json     @default("[]") // ["ISO9001", "LEED", "OHSAS18001"]
  specialties       Json     @default("[]")
  metadata          Json     @default("{}")
  
  // Stats (computed/cached)
  avgRating         Decimal? @map("avg_rating") @db.Decimal(3, 2)
  reviewCount       Int      @default(0) @map("review_count")
  orgCount          Int      @default(0) @map("org_count")
  
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

model GlobalPartyContact {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  fullName      String   @map("full_name")
  role          String?  // "Sales Manager", "Regional Director"
  email         String?
  phone         String?
  region        String?  // "North America", "LATAM"
  language      String?  // "es", "en", "pt"
  isPrimary     Boolean  @default(false) @map("is_primary")
  active        Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id], onDelete: Cascade)

  @@index([globalPartyId])
  @@index([region])
  @@map("global_party_contacts")
  @@schema("public")
}

model OrgPartyLink {
  id                String   @id @default(uuid())
  orgId             String   @map("org_id")
  globalPartyId     String   @map("global_party_id")
  
  // Local Overrides
  localAlias        String?  @map("local_alias")
  localContactName  String?  @map("local_contact_name")
  localContactEmail String?  @map("local_contact_email")
  localContactPhone String?  @map("local_contact_phone")
  
  // Business Terms
  preferred         Boolean  @default(false)
  status            String   @default("ACTIVE") // ACTIVE|INACTIVE|BLOCKED
  paymentTerms      String?  @map("payment_terms") // "Net 30", "Net 60"
  discountPct       Decimal? @map("discount_pct") @db.Decimal(5, 2)
  creditLimit       Decimal? @map("credit_limit") @db.Decimal(15, 2)
  
  // Internal Reference
  notes             String?  @db.Text
  internalCode      String?  @map("internal_code")
  tags              String[] // ["preferido", "económico", "rápido"]
  
  // Stats (computed)
  totalOrders       Int      @default(0) @map("total_orders")
  totalSpent        Decimal  @default(0) @map("total_spent") @db.Decimal(15, 2)
  lastOrderDate     DateTime? @map("last_order_date")
  
  createdByOrgMemberId String @map("created_by_org_member_id")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  globalParty  GlobalParty  @relation(fields: [globalPartyId], references: [id])
  createdBy    OrgMember    @relation(fields: [createdByOrgMemberId], references: [id])

  @@unique([orgId, globalPartyId])
  @@index([orgId, preferred])
  @@index([orgId, status])
  @@map("org_party_links")
  @@schema("public")
}

model GlobalPartyClaim {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  
  // Claimant Information
  claimantName  String   @map("claimant_name")
  claimantEmail String   @map("claimant_email")
  claimantPhone String?  @map("claimant_phone")
  claimantRole  String   @map("claimant_role") // "Owner", "Marketing Manager"
  company       String?  // Company they claim to represent
  
  // Verification
  status        String   @default("PENDING") // PENDING|VERIFIED|REJECTED
  verificationToken String? @unique @map("verification_token")
  verificationDocs  String[] @map("verification_docs") // URLs to uploaded docs
  message       String?  @db.Text
  
  // Review by Staff
  reviewedBy    String?  @map("reviewed_by") // Staff user ID
  reviewedAt    DateTime? @map("reviewed_at")
  reviewNotes   String?  @map("review_notes") @db.Text
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id], onDelete: Cascade)

  @@index([globalPartyId])
  @@index([status])
  @@index([claimantEmail])
  @@map("global_party_claims")
  @@schema("public")
}

model GlobalPartyReview {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  orgId         String   @map("org_id")
  orgMemberId   String   @map("org_member_id")
  
  // Overall Rating
  rating        Int      // 1-5 stars
  title         String?
  review        String?  @db.Text
  
  // Detailed Ratings (optional)
  qualityRating  Int?    @map("quality_rating")   // 1-5
  deliveryRating Int?    @map("delivery_rating")  // 1-5
  priceRating    Int?    @map("price_rating")     // 1-5
  serviceRating  Int?    @map("service_rating")   // 1-5
  
  // Verification
  verified      Boolean  @default(false)
  verifiedBy    String?  @map("verified_by") // Staff who verified
  orderIds      String[] @map("order_ids") // Related commitment/transaction IDs
  
  // Moderation
  status        String   @default("PUBLISHED") // PUBLISHED|FLAGGED|REMOVED
  flaggedReason String?  @map("flagged_reason")
  moderatedBy   String?  @map("moderated_by")
  moderatedAt   DateTime? @map("moderated_at")
  
  // Supplier Response
  supplierResponse String? @map("supplier_response") @db.Text
  respondedAt   DateTime? @map("responded_at")
  
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id], onDelete: Cascade)

  @@unique([globalPartyId, orgId])
  @@index([globalPartyId, status])
  @@index([rating])
  @@map("global_party_reviews")
  @@schema("public")
}

model GlobalProduct {
  id            String   @id @default(uuid())
  globalPartyId String   @map("global_party_id")
  
  // Product Info
  sku           String
  name          String
  description   String?  @db.Text
  category      String
  subcategory   String?
  unit          String   // "m3", "ton", "unit", "kg"
  
  // Reference Pricing
  referencePriceMin Decimal? @map("reference_price_min") @db.Decimal(15, 2)
  referencePriceMax Decimal? @map("reference_price_max") @db.Decimal(15, 2)
  currency      String   @default("USD")
  priceUpdatedAt DateTime? @map("price_updated_at")
  
  // Specifications
  specifications Json    @default("{}")
  certifications String[] // ["ISO9001", "CE", "UL"]
  technicalDocs  String[] @map("technical_docs") // URLs
  
  // Media
  imageUrl      String?  @map("image_url")
  images        String[] // Additional images
  datasheetUrl  String?  @map("datasheet_url")
  videoUrl      String?  @map("video_url")
  
  // Availability
  availability  String   @default("AVAILABLE") // AVAILABLE|OUT_OF_STOCK|DISCONTINUED
  leadTimeDays  Int?     @map("lead_time_days")
  minOrderQty   Decimal? @map("min_order_qty") @db.Decimal(15, 4)
  
  active        Boolean  @default(true)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  // Relations
  globalParty GlobalParty @relation(fields: [globalPartyId], references: [id], onDelete: Cascade)

  @@unique([globalPartyId, sku])
  @@index([category])
  @@index([name])
  @@map("global_products")
  @@schema("public")
}
```

---

## Actualización a Organization

Agregar esta relación en el modelo Organization:

```prisma
model Organization {
  // ... existing fields ...
  
  // Relations
  // ... existing relations ...
  orgPartyLinks       OrgPartyLink[]
  
  // ... rest of relations ...
}
```

---

## Actualización a OrgMember

Agregar esta relación en el modelo OrgMember:

```prisma
model OrgMember {
  // ... existing fields ...
  
  // Relations
  // ... existing relations ...
  createdOrgPartyLinks OrgPartyLink[]
  
  // ... rest of relations ...
}
```

---

## Actualización a Party (Opcional - para backward compat)

Agregar campo opcional para link a GlobalParty:

```prisma
model Party {
  id          String   @id @default(uuid())
  orgId       String   @map("org_id")
  
  // NEW: Source tracking
  sourceType  String   @default("LOCAL") @map("source_type") // LOCAL|GLOBAL_LINKED
  globalPartyId String? @map("global_party_id")
  
  partyType   String   @map("party_type")
  name        String
  // ... rest of existing fields ...
  
  // Relations
  organization Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  
  // NEW: Optional link to global party (if created from global)
  globalParty  GlobalParty? @relation(fields: [globalPartyId], references: [id])
  
  // ... existing relations ...
}
```

**NOTA:** Esto es opcional. Puedes mantener Party completamente separado y usar solo OrgPartyLink.

---

## Migración de Datos (cuando implementes)

```typescript
// Ejemplo: Migrar Party existente a GlobalParty
async function migratePartyToGlobal(partyId: string) {
  const party = await prisma.party.findUnique({ 
    where: { id: partyId },
    include: { contacts: true }
  })
  
  // 1. Crear GlobalParty
  const globalParty = await prisma.globalParty.create({
    data: {
      name: party.name,
      taxId: party.taxId,
      email: party.email,
      phone: party.phone,
      category: inferCategory(party.partyType),
      verified: false,
    }
  })
  
  // 2. Crear OrgPartyLink
  await prisma.orgPartyLink.create({
    data: {
      orgId: party.orgId,
      globalPartyId: globalParty.id,
      localAlias: party.name,
      status: 'ACTIVE',
      createdByOrgMemberId: getCurrentUserId(),
    }
  })
  
  // 3. Migrar contactos
  for (const contact of party.contacts) {
    await prisma.orgPartyLink.update({
      where: { orgId_globalPartyId: { orgId: party.orgId, globalPartyId: globalParty.id } },
      data: {
        localContactName: contact.fullName,
        localContactEmail: contact.email,
        localContactPhone: contact.phone,
      }
    })
  }
  
  // 4. Actualizar Party para indicar que viene de global
  await prisma.party.update({
    where: { id: partyId },
    data: {
      sourceType: 'GLOBAL_LINKED',
      globalPartyId: globalParty.id,
    }
  })
}
```

---

## Índices de Búsqueda Recomendados

Para búsqueda eficiente de proveedores globales:

```sql
-- Full-text search en nombre y descripción
CREATE INDEX idx_global_parties_fts 
ON global_parties 
USING gin(to_tsvector('spanish', name || ' ' || COALESCE(description, '')));

-- Búsqueda geográfica
CREATE INDEX idx_global_parties_countries 
ON global_parties 
USING gin(countries);

-- Categorías
CREATE INDEX idx_global_parties_category 
ON global_parties(category, verified);
```

O usar Prisma's fullTextSearch:

```prisma
model GlobalParty {
  // ... fields ...
  
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin)
}
```

---

## Total de Tablas Nuevas

**6 tablas agregadas:**
1. GlobalParty
2. GlobalPartyContact
3. OrgPartyLink
4. GlobalPartyClaim
5. GlobalPartyReview
6. GlobalProduct

**Total en sistema:** 51 + 6 = **57 tablas**

---

## Siguiente Paso

Voy a generar el schema.prisma completo con estos cambios integrados.
