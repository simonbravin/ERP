import 'next-auth'

export type OrgRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'ACCOUNTANT' | 'VIEWER' | 'SUPER_ADMIN'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string | null
      name: string | null
      image?: string | null
      isSuperAdmin?: boolean
      orgId?: string
      orgMemberId?: string
      role?: OrgRole
      orgName?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    picture?: string
    isSuperAdmin?: boolean
    orgId?: string
    orgMemberId?: string
    role?: string
    orgName?: string
  }
}
