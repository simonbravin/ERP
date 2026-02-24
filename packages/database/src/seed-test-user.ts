/**
 * Crea usuario de prueba test@bravingroup.com (contraseña 123qwe123)
 * y lo agrega como miembro de la misma organización donde bravin.simon@gmail.com es admin.
 *
 * Ejecutar desde raíz: pnpm --filter @repo/database run db:seed-test-user
 * O desde packages/database: npx tsx src/seed-test-user.ts
 */
import bcrypt from 'bcryptjs'
import { prisma } from './client'

const ADMIN_EMAIL = 'bravin.simon@gmail.com'
const TEST_EMAIL = 'test@bravingroup.com'
const TEST_PASSWORD = '123qwe123'
const TEST_FULL_NAME = 'Test Bravin'

async function main() {
  const adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, email: true, fullName: true },
  })

  if (!adminUser) {
    console.error(`No se encontró usuario con email ${ADMIN_EMAIL}. Crealo primero o cambia ADMIN_EMAIL en el script.`)
    process.exit(1)
  }

  const adminMembership = await prisma.orgMember.findFirst({
    where: { userId: adminUser.id, active: true },
    include: { organization: { select: { id: true, name: true } } },
  })

  if (!adminMembership) {
    console.error(`El usuario ${ADMIN_EMAIL} no es miembro de ninguna organización.`)
    process.exit(1)
  }

  const orgId = adminMembership.organization.id
  const orgName = adminMembership.organization.name

  let testUser = await prisma.user.findUnique({
    where: { email: TEST_EMAIL },
    select: { id: true, email: true, fullName: true },
  })

  if (!testUser) {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10)
    testUser = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        fullName: TEST_FULL_NAME,
        passwordHash,
        active: true,
      },
      select: { id: true, email: true, fullName: true },
    })
    console.log(`Usuario creado: ${testUser.email} (${testUser.fullName})`)
  } else {
    console.log(`Usuario ya existía: ${testUser.email}`)
  }

  const existingMember = await prisma.orgMember.findUnique({
    where: {
      orgId_userId: { orgId, userId: testUser.id },
    },
  })

  if (existingMember) {
    console.log(`Ya es miembro de "${orgName}". Rol actual: ${existingMember.role}.`)
    return
  }

  await prisma.orgMember.create({
    data: {
      orgId,
      userId: testUser.id,
      role: 'EDITOR',
      active: true,
    },
  })

  console.log(`Agregado a la organización "${orgName}" como EDITOR.`)
  console.log('')
  console.log('Credenciales de prueba:')
  console.log(`  Email:    ${TEST_EMAIL}`)
  console.log(`  Password: ${TEST_PASSWORD}`)
  console.log(`  Org:     ${orgName} (donde ${ADMIN_EMAIL} es admin)`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
