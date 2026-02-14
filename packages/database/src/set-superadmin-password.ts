/**
 * Asegura que el usuario superadmin exista y pueda entrar al portal superadmin.
 * Usuario: superadmin
 * Contraseña: Livestrong=15
 *
 * Ejecutar desde repo root: pnpm --filter @repo/database set-superadmin-password
 * O desde packages/database: pnpm set-superadmin-password
 */
import bcrypt from 'bcryptjs'
import { prisma } from './client'

const USERNAME = 'superadmin'
const PLACEHOLDER_EMAIL = 'superadmin@system.internal'
const PASSWORD = 'Livestrong=15'

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: USERNAME }, { email: PLACEHOLDER_EMAIL }],
    },
    select: { id: true, username: true, email: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        username: USERNAME,
        email: PLACEHOLDER_EMAIL,
        fullName: 'Super Administrator',
        passwordHash,
        isSuperAdmin: true,
        active: true,
      },
    })
    console.log('Super Admin actualizado.')
  } else {
    await prisma.user.create({
      data: {
        username: USERNAME,
        email: PLACEHOLDER_EMAIL,
        fullName: 'Super Administrator',
        passwordHash,
        isSuperAdmin: true,
        active: true,
      },
    })
    console.log('Super Admin creado.')
  }

  console.log('')
  console.log('Portal Super Admin:')
  console.log('  Usuario:    superadmin')
  console.log('  Contraseña: Livestrong=15')
  console.log('  URL:        /super-admin/login (o la ruta de login superadmin de tu app)')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
