/**
 * One-time data migration: SUBCONTRACT → EQUIPMENT
 * Run only if you have existing budget data with resourceType/type = 'SUBCONTRACT'.
 * Usage: pnpm tsx src/migrate-subcontract-to-equipment.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  console.log('Migrando SUBCONTRACT → EQUIPMENT...')

  // BudgetResource uses resourceType
  const budgetResourcesUpdated = await prisma.budgetResource.updateMany({
    where: { resourceType: 'SUBCONTRACT' },
    data: { resourceType: 'EQUIPMENT' },
  })

  console.log(`BudgetResource: ${budgetResourcesUpdated.count} registros actualizados`)

  // BudgetResourceTemplate uses type
  const templatesUpdated = await prisma.budgetResourceTemplate.updateMany({
    where: { type: 'SUBCONTRACT' },
    data: { type: 'EQUIPMENT' },
  })

  console.log(`BudgetResourceTemplate: ${templatesUpdated.count} registros actualizados`)

  console.log('✅ Migración completada')
}

migrate()
  .catch((e) => {
    console.error('❌ Error en migración:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
