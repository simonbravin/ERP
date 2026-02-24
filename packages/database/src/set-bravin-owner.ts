/**
 * One-off: set org role to OWNER for user bravin.simon@gmail.com (creator of the company).
 * Run from repo root: pnpm --filter @repo/database exec tsx src/set-bravin-owner.ts
 * Or from packages/database: npx tsx src/set-bravin-owner.ts
 */
import { prisma } from './client'

const EMAIL = 'bravin.simon@gmail.com'

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: EMAIL },
    select: { id: true, email: true, fullName: true },
  })

  if (!user) {
    console.log(`No user found with email ${EMAIL}.`)
    process.exit(1)
  }

  const updated = await prisma.orgMember.updateMany({
    where: { userId: user.id },
    data: { role: 'OWNER' },
  })

  console.log(`User: ${user.fullName} (${user.email})`)
  console.log(`Updated ${updated.count} org membership(s) to role OWNER.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
