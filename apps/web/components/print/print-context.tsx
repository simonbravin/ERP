'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type PrintOrg = {
  orgId: string
  orgName: string
}

export type PrintOrgProfile = {
  legalName: string | null
  taxId: string | null
  country: string | null
  address: string | null
  email: string | null
  phone: string | null
}

export type PrintUser = {
  fullName: string
  email: string | null
}

type PrintContextValue = {
  org: PrintOrg
  orgProfile: PrintOrgProfile | null
  user: PrintUser | null
  logoUrl: string | null
}

const PrintContext = createContext<PrintContextValue | null>(null)

type PrintProviderProps = {
  org: PrintOrg
  orgProfile: PrintOrgProfile | null
  user: PrintUser | null
  logoUrl: string | null
  children: ReactNode
}

export function PrintProvider({
  org,
  orgProfile,
  user,
  logoUrl,
  children,
}: PrintProviderProps) {
  return (
    <PrintContext.Provider
      value={{
        org,
        orgProfile,
        user,
        logoUrl,
      }}
    >
      {children}
    </PrintContext.Provider>
  )
}

export function usePrintContext(): PrintContextValue {
  const ctx = useContext(PrintContext)
  if (!ctx) {
    throw new Error('usePrintContext must be used within PrintProvider')
  }
  return ctx
}
