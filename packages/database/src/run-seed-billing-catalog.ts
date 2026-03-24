import { prisma } from './client'
import { seedBillingCatalogFromEnv } from './seed-billing-catalog'

async function main() {
  await seedBillingCatalogFromEnv()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
