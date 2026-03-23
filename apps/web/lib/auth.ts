import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@repo/database'
import bcrypt from 'bcryptjs'

// NextAuth v5 / Auth.js can read AUTH_SECRET and AUTH_URL; we also use NEXTAUTH_* in middleware. Unify so both work.
if (!process.env.AUTH_SECRET?.trim() && process.env.NEXTAUTH_SECRET?.trim()) {
  process.env.AUTH_SECRET = process.env.NEXTAUTH_SECRET
}
if (!process.env.AUTH_URL?.trim() && process.env.NEXTAUTH_URL?.trim()) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true, // required on Vercel so session cookie is set for the request host
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/es/login',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const email = String(credentials.email).trim()
          const password = String(credentials.password).trim()
          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              fullName: true,
              avatarUrl: true,
              active: true,
              passwordHash: true,
              isSuperAdmin: true,
            },
          })
          if (!user || !user.active || !user.passwordHash) return null
          const valid = await bcrypt.compare(password, user.passwordHash)
          if (!valid) return null
          const avatar = user.avatarUrl ?? undefined
          return {
            id: user.id,
            email: user.email,
            name: user.fullName,
            // r2: keys are not valid img src; sidebar resolves avatar from DB in layout.
            image:
              avatar && !avatar.startsWith('r2:')
                ? avatar
                : undefined,
            isSuperAdmin: user.isSuperAdmin ?? false,
          }
        } catch (err) {
          console.error('[auth] authorize error:', err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user?.id) return false
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { isSuperAdmin: true },
      })
      if (dbUser?.isSuperAdmin) return true
      const orgMember = await prisma.orgMember.findFirst({
        where: { userId: user.id, active: true },
      })
      if (!orgMember) {
        console.warn('[auth] signIn callback: user has no active orgMember', { userId: user.id, email: user.email })
        return false
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        token.email = user.email ?? undefined
        token.name = user.name ?? undefined
        token.picture = user.image ?? undefined
        const isSuperAdmin = (user as { isSuperAdmin?: boolean }).isSuperAdmin ?? false
        if (isSuperAdmin) {
          token.isSuperAdmin = true
          token.role = 'SUPER_ADMIN'
          return token
        }
        const orgMember = await prisma.orgMember.findFirst({
          where: { userId: user.id, active: true },
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        })
        if (orgMember) {
          token.orgId = orgMember.orgId
          token.orgMemberId = orgMember.id
          token.role = orgMember.role
          token.orgName = orgMember.organization.name
        }
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ''
        session.user.email = token.email ?? ''
        session.user.name = token.name ?? ''
        session.user.image =
          typeof token.picture === 'string' && token.picture.length > 0 ? token.picture : null
        session.user.isSuperAdmin = token.isSuperAdmin as boolean | undefined
        session.user.orgId = token.orgId as string | undefined
        session.user.orgMemberId = token.orgMemberId as string | undefined
        session.user.role = token.role as 'OWNER' | 'ADMIN' | 'EDITOR' | 'ACCOUNTANT' | 'VIEWER' | 'SUPER_ADMIN' | undefined
        session.user.orgName = token.orgName as string | undefined
      }
      return session
    },
  },
})
