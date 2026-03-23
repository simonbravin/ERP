'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import {
  hasPermission,
  canAccess,
  MODULES,
  type Permission,
  type CustomPermissionsMap,
} from '@/lib/permissions'
import type { SessionOrgRole } from '@/lib/permissions'

type ModuleKey = keyof typeof MODULES

export function usePermissions() {
  const { data: session, status } = useSession()
  const [customPermissions, setCustomPermissions] = useState<CustomPermissionsMap>(null)
  const [loading, setLoading] = useState(true)

  const orgMemberId = session?.user?.orgMemberId

  useEffect(() => {
    if (!orgMemberId) {
      setLoading(false)
      return
    }
    fetch(`/api/member-permissions/${orgMemberId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { customPermissions?: CustomPermissionsMap; role?: string }) => {
        setCustomPermissions(data.customPermissions ?? null)
      })
      .catch(() => setCustomPermissions(null))
      .finally(() => setLoading(false))
  }, [orgMemberId])

  const role = session?.user?.role as SessionOrgRole | undefined

  const can = (moduleKey: ModuleKey, permission: Permission): boolean => {
    if (!role) return false
    const module = MODULES[moduleKey]
    return hasPermission(role, module, permission, customPermissions)
  }

  const canView = (moduleKey: ModuleKey): boolean => {
    if (!role) return false
    const module = MODULES[moduleKey]
    return canAccess(role, module, customPermissions)
  }

  return { can, canView, role, status, loading: loading || status === 'loading', customPermissions }
}
