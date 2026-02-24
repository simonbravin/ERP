/**
 * Set org role for a user by email. No hardcoded values.
 * Uses env: SET_ORG_ROLE_EMAIL (required), SET_ORG_ROLE (optional, default ADMIN).
 *
 * Example (PowerShell):
 *   $env:SET_ORG_ROLE_EMAIL="bravin.simon@gmail.com"; $env:SET_ORG_ROLE="ADMIN"; pnpm --filter @repo/database run set-org-role
 *
 * Example (bash):
 *   SET_ORG_ROLE_EMAIL=bravin.simon@gmail.com SET_ORG_ROLE=ADMIN pnpm --filter @repo/database run set-org-role
 */
import { prisma } from './client'

const VALID_ROLES = ['ADMIN', 'EDITOR', 'ACCOUNTANT', 'VIEWER'] as const

async function main() {
  const email = process.env.SET_ORG_ROLE_EMAIL?.trim()
  const role = (process.env.SET_ORG_ROLE?.trim()?.toUpperCase() ?? 'ADMIN') as (typeof VALID_ROLES)[number]

  if (!email) {
    console.error('Missing SET_ORG_ROLE_EMAIL. Example: SET_ORG_ROLE_EMAIL=user@example.com SET_ORG_ROLE=ADMIN pnpm --filter @repo/database run set-org-role')
    process.exit(1)
  }

  if (!VALID_ROLES.includes(role)) {
    console.error(`SET_ORG_ROLE must be one of: ${VALID_ROLES.join(', ')}`)
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true },
  })

  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  const updated = await prisma.orgMember.updateMany({
    where: { userId: user.id },
    data: { role },
  })

  console.log(`User: ${user.fullName ?? user.email} (${user.email})`)
  console.log(`Updated ${updated.count} org membership(s) to role ${role}.`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
