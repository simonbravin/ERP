'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import {
  updateUserModules,
  toggleUserStatus,
  resetUserPassword,
  setOrgMemberRole,
} from '@/app/actions/super-admin'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Save,
  Building2,
  Mail,
  Calendar,
  Shield,
  Key,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Link } from '@/i18n/navigation'

const MODULE_KEYS = [
  'DASHBOARD',
  'PROJECTS',
  'BUDGET',
  'SCHEDULE',
  'MATERIALS',
  'FINANCE',
  'CERTIFICATIONS',
  'INVENTORY',
  'REPORTS',
  'SUPPLIERS',
  'TEAM',
  'SETTINGS',
  'DOCUMENTS',
] as const

interface UserEditClientProps {
  user: {
    id: string
    fullName: string | null
    email: string
    createdAt: string
    orgMembers: Array<{
      id: string
      role: string
      isActive: boolean
      customPermissions: Record<string, string[]> | null
      organization: {
        id: string
        name: string
        legalName: string | null
        isBlocked: boolean
      }
    }>
  }
  /** Si es el usuario actual (ej. super-admin editándose a sí mismo), no puede cambiar su propio rol. */
  currentUserId?: string
}

function getDefaultModulesByRole(role: string): string[] {
  const defaults: Record<string, string[]> = {
    OWNER: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'FINANCE', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS', 'SUPPLIERS', 'TEAM', 'SETTINGS', 'DOCUMENTS'],
    ADMIN: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'FINANCE', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS', 'SUPPLIERS', 'TEAM', 'SETTINGS', 'DOCUMENTS'],
    EDITOR: ['DASHBOARD', 'PROJECTS', 'BUDGET', 'SCHEDULE', 'MATERIALS', 'CERTIFICATIONS', 'INVENTORY', 'REPORTS', 'SUPPLIERS'],
    ACCOUNTANT: ['DASHBOARD', 'FINANCE', 'REPORTS'],
    VIEWER: ['DASHBOARD', 'PROJECTS', 'REPORTS'],
  }
  return defaults[role] ?? []
}

export function UserEditClient({ user, currentUserId }: UserEditClientProps) {
  const t = useTranslations('superAdmin')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const moduleKeysUpper = [...MODULE_KEYS]

  const [orgModules, setOrgModules] = useState<Record<string, string[]>>(() => {
    const initial: Record<string, string[]> = {}
    user.orgMembers.forEach((member) => {
      if (member.customPermissions && typeof member.customPermissions === 'object') {
        const storedKeys = Object.keys(member.customPermissions) as string[]
        initial[member.organization.id] = storedKeys
          .map((k) => moduleKeysUpper.find((mk) => mk.toLowerCase() === k.toLowerCase()))
          .filter((key): key is (typeof MODULE_KEYS)[number] => key != null)
      } else {
        initial[member.organization.id] = getDefaultModulesByRole(member.role)
      }
    })
    return initial
  })

  const [orgActiveStatus, setOrgActiveStatus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    user.orgMembers.forEach((member) => {
      initial[member.organization.id] = member.isActive
    })
    return initial
  })

  function handleModuleToggle(orgId: string, moduleKey: string) {
    setOrgModules((prev) => {
      const current = prev[orgId] || []
      const updated = current.includes(moduleKey)
        ? current.filter((m) => m !== moduleKey)
        : [...current, moduleKey]
      return { ...prev, [orgId]: updated }
    })
  }

  function handleSaveModules(orgId: string) {
    const modules = orgModules[orgId] || []
    startTransition(async () => {
      try {
        const result = await updateUserModules(user.id, orgId, modules)
        if (result.success) {
          toast.success(t('toast.modulesUpdated'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('toast.modulesError'))
        }
      } catch {
        toast.error(t('toast.modulesError'))
      }
    })
  }

  function handleToggleActive(orgId: string) {
    const newStatus = !orgActiveStatus[orgId]
    startTransition(async () => {
      try {
        const result = await toggleUserStatus(user.id, orgId, newStatus)
        if (result.success) {
          setOrgActiveStatus((prev) => ({ ...prev, [orgId]: newStatus }))
          toast.success(newStatus ? t('toast.userActivated') : t('toast.userDeactivated'))
          router.refresh()
        } else {
          toast.error(result.error ?? t('toast.statusError'))
        }
      } catch {
        toast.error(t('toast.statusError'))
      }
    })
  }

  function handleResetPassword() {
    if (newPassword !== confirmPassword) {
      toast.error(t('toast.passwordsMismatch'))
      return
    }
    if (newPassword.length < 8) {
      toast.error(t('toast.passwordMinLength'))
      return
    }
    startTransition(async () => {
      try {
        const result = await resetUserPassword(user.id, newPassword)
        if (result.success) {
          toast.success(t('toast.passwordResetOk'))
          setShowResetPassword(false)
          setNewPassword('')
          setConfirmPassword('')
          router.refresh()
        } else {
          toast.error(result.error ?? t('toast.passwordResetError'))
        }
      } catch {
        toast.error(t('toast.passwordResetError'))
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/super-admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToUsers')}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {user.fullName ?? t('noName')}
            </h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
        </div>
        <Button onClick={() => setShowResetPassword(true)} variant="outline">
          <Key className="mr-2 h-4 w-4" />
          {t('resetPasswordButton')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('userInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">{t('labelEmail')}</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">{t('labelCreated')}</p>
                <p className="font-medium">
                  {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">{t('labelOrganizations')}</p>
                <p className="font-medium">{user.orgMembers.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {user.orgMembers.map((member) => (
        <Card key={member.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {member.organization.name}
                  {member.organization.isBlocked && (
                    <Badge variant="destructive">{t('orgBlockedBadge')}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {member.organization.legalName ?? t('noLegalName')}
                </CardDescription>
              </div>
                <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`active-${member.id}`} className="text-sm">
                    {orgActiveStatus[member.organization.id] ? t('active') : t('inactive')}
                  </Label>
                  <Switch
                    id={`active-${member.id}`}
                    checked={orgActiveStatus[member.organization.id]}
                    onCheckedChange={() => handleToggleActive(member.organization.id)}
                    disabled={isPending}
                  />
                </div>
                {member.role === 'OWNER' ? (
                  <Badge variant="outline">
                    <Shield className="mr-1 h-3 w-3" />
                    OWNER
                  </Badge>
                ) : (
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`role-${member.id}`} className="text-sm text-muted-foreground">
                      {t('orgRoleLabel')}
                    </Label>
                    <Select
                      value={member.role}
                      onValueChange={(value) => {
                        const role = value as 'ADMIN' | 'EDITOR' | 'ACCOUNTANT' | 'VIEWER'
                        startTransition(async () => {
                          const result = await setOrgMemberRole(user.id, member.organization.id, role)
                          if (result.success === true) {
                            toast.success(t('toast.roleUpdated'))
                            router.refresh()
                          } else {
                            toast.error(result.error)
                          }
                        })
                      }}
                      disabled={isPending || (currentUserId != null && user.id === currentUserId)}
                    >
                      <SelectTrigger id={`role-${member.id}`} className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">ADMIN</SelectItem>
                        <SelectItem value="EDITOR">EDITOR</SelectItem>
                        <SelectItem value="ACCOUNTANT">ACCOUNTANT</SelectItem>
                        <SelectItem value="VIEWER">VIEWER</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-3 text-sm font-semibold">{t('modulesEnabledTitle')}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {MODULE_KEYS.map((moduleKey) => {
                  const isEnabled = (orgModules[member.organization.id] ?? []).includes(moduleKey)
                  return (
                    <div
                      key={moduleKey}
                      className="flex items-start space-x-3 rounded-lg border p-3"
                    >
                      <Checkbox
                        id={`${member.id}-${moduleKey}`}
                        checked={isEnabled}
                        onCheckedChange={() => handleModuleToggle(member.organization.id, moduleKey)}
                        disabled={isPending}
                      />
                      <div className="grid gap-1.5 leading-none">
                        <label
                          htmlFor={`${member.id}-${moduleKey}`}
                          className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {t(`modules.${moduleKey}.label` as 'modules.DASHBOARD.label')}
                        </label>
                        <p className="text-xs text-slate-500">
                          {t(`modules.${moduleKey}.description` as 'modules.DASHBOARD.description')}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button
                onClick={() => handleSaveModules(member.organization.id)}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('savingModules')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('saveModulesButton')}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
        <DialogContent className="erp-form-modal max-w-xl gap-6 py-6">
          <DialogHeader>
            <DialogTitle>{t('resetPasswordTitle')}</DialogTitle>
            <DialogDescription className="text-foreground/80">
              {t('resetPasswordDescription', { name: user.fullName ?? user.email })}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-5 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-sm font-medium text-foreground">
                {t('newPasswordLabel')}
              </Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('newPasswordPlaceholder')}
                className="mt-1 w-full min-w-0"
                autoComplete="new-password"
              />
              <p className="text-sm text-muted-foreground">{t('passwordMin8Hint')}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                {t('confirmPasswordLabel')}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('newPasswordPlaceholder')}
                className="mt-1 w-full min-w-0"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowResetPassword(false)}
              disabled={isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isPending || !newPassword || !confirmPassword}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('resettingPassword')}
                </>
              ) : (
                t('resetPasswordTitle')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
