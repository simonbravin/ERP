'use client'

import { useRouter } from '@/i18n/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  adminExtendTrialAction,
  adminRevokeManualOverrideAction,
  adminSetManualBillingOverrideAction,
} from '@/app/actions/super-admin-billing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Link } from '@/i18n/navigation'

export type SerializedOverride = {
  id: string
  mode: string
  reason: string | null
  endsAt: string | null
  createdAt: string
}

export function SuperAdminOrgBillingControls({
  orgId,
  orgName,
  hasSubscription,
  overrides,
}: {
  orgId: string
  orgName: string
  hasSubscription: boolean
  overrides: SerializedOverride[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [freeMode, setFreeMode] = useState<'MANUAL_ACTIVE' | 'ENTERPRISE_BYPASS'>('MANUAL_ACTIVE')
  const [freeEndsAt, setFreeEndsAt] = useState('')
  const [freeNoEnd, setFreeNoEnd] = useState(false)
  const [freeReason, setFreeReason] = useState('')

  const [lockEndsAt, setLockEndsAt] = useState('')
  const [lockReason, setLockReason] = useState('')

  const [trialEnd, setTrialEnd] = useState('')
  const [trialReason, setTrialReason] = useState('')

  function refresh() {
    router.refresh()
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Control manual de acceso (billing)</CardTitle>
        <CardDescription>
          Todo esto actúa sobre <strong>esta organización</strong> ({orgName}). Los cambios aplican al instante para
          permisos de escritura según la política de billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dónde queda cada cosa</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Acceso gratis / contrato manual</strong> → override{' '}
              <code className="rounded bg-background px-1">MANUAL_ACTIVE</code> o{' '}
              <code className="rounded bg-background px-1">ENTERPRISE_BYPASS</code> (mismo efecto: pueden usar el ERP
              aunque Paddle diga otra cosa).
            </li>
            <li>
              <strong>Solo lectura por billing</strong> →{' '}
              <code className="rounded bg-background px-1">MANUAL_LOCK</code> (entran pero no pueden mutar datos).
            </li>
            <li>
              <strong>Bloquear la org por completo</strong> (nadie entra) →{' '}
              <Link href={`/super-admin/organizations/${orgId}`} className="text-primary underline">
                ficha Organización
              </Link>{' '}
              → Block.
            </li>
          </ul>
        </div>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Otorgar acceso sin cobro (o bonificado)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={freeMode} onValueChange={(v) => setFreeMode(v as typeof freeMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL_ACTIVE">Acceso manual activo (gratis / promo interna)</SelectItem>
                  <SelectItem value="ENTERPRISE_BYPASS">Enterprise / contrato fuera de Paddle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vencimiento (opcional)</Label>
              <Input
                type="datetime-local"
                value={freeEndsAt}
                onChange={(e) => setFreeEndsAt(e.target.value)}
                disabled={freeNoEnd || pending}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={freeNoEnd}
                  onChange={(e) => setFreeNoEnd(e.target.checked)}
                  disabled={pending}
                />
                Sin fecha de fin (hasta que revoques vos)
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Motivo (auditoría)</Label>
            <Textarea
              value={freeReason}
              onChange={(e) => setFreeReason(e.target.value)}
              placeholder="Ej. 3 meses bonificados por acuerdo comercial"
              rows={2}
              disabled={pending}
            />
          </div>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await adminSetManualBillingOverrideAction({
                    orgId,
                    mode: freeMode,
                    active: true,
                    reason: freeReason.trim() || undefined,
                    endsAt: freeNoEnd ? undefined : freeEndsAt.trim() ? new Date(freeEndsAt) : undefined,
                  })
                  toast.success('Acceso manual otorgado')
                  setFreeReason('')
                  refresh()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Error')
                }
              })
            }}
          >
            Aplicar acceso gratis
          </Button>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-sm font-semibold">Forzar solo lectura (hasta que paguen / regularicen)</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vencimiento del bloqueo (opcional)</Label>
              <Input
                type="datetime-local"
                value={lockEndsAt}
                onChange={(e) => setLockEndsAt(e.target.value)}
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">Vacío = el lock no caduca por fecha (revisá overrides).</p>
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                placeholder="Ej. Deuda pendiente — contactar cobranzas"
                rows={3}
                disabled={pending}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                try {
                  await adminSetManualBillingOverrideAction({
                    orgId,
                    mode: 'MANUAL_LOCK',
                    active: true,
                    reason: lockReason.trim() || undefined,
                    endsAt: lockEndsAt.trim() ? new Date(lockEndsAt) : undefined,
                  })
                  toast.success('MANUAL_LOCK aplicado (solo lectura en la app)')
                  setLockReason('')
                  setLockEndsAt('')
                  refresh()
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Error')
                }
              })
            }}
          >
            Aplicar bloqueo de escritura
          </Button>
        </section>

        {hasSubscription ? (
          <section className="space-y-3 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">Extender trial (requiere fila de suscripción en BD)</h3>
            <p className="text-xs text-muted-foreground">
              Pone estado <code className="rounded bg-muted px-1">TRIALING</code> y la nueva fecha de fin de trial.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label>Nuevo trial hasta</Label>
                <Input
                  type="datetime-local"
                  value={trialEnd}
                  onChange={(e) => setTrialEnd(e.target.value)}
                  disabled={pending}
                />
              </div>
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label>Motivo</Label>
                <Input
                  value={trialReason}
                  onChange={(e) => setTrialReason(e.target.value)}
                  placeholder="Opcional"
                  disabled={pending}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !trialEnd.trim()}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await adminExtendTrialAction(
                        orgId,
                        new Date(trialEnd),
                        trialReason.trim() || undefined
                      )
                      toast.success('Trial actualizado')
                      setTrialEnd('')
                      setTrialReason('')
                      refresh()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Error')
                    }
                  })
                }}
              >
                Guardar trial
              </Button>
            </div>
          </section>
        ) : (
          <p className="border-t border-border pt-6 text-sm text-muted-foreground">
            No hay <code className="rounded bg-muted px-1">OrganizationSubscription</code> para esta org: no se puede
            extender trial hasta hacer backfill o primer checkout.
          </p>
        )}

        <section className="space-y-3 border-t border-border pt-6">
          <h3 className="text-sm font-semibold">Quitar overrides por tipo (todos los activos de ese modo)</h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['MANUAL_ACTIVE', 'Quitar acceso gratis (MANUAL_ACTIVE)'],
                ['ENTERPRISE_BYPASS', 'Quitar enterprise bypass'],
                ['MANUAL_LOCK', 'Quitar bloqueo de escritura'],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      await adminSetManualBillingOverrideAction({
                        orgId,
                        mode,
                        active: false,
                      })
                      toast.success(`Overrides ${mode} desactivados`)
                      refresh()
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Error')
                    }
                  })
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>

        {overrides.length > 0 ? (
          <section className="space-y-2 border-t border-border pt-6">
            <h3 className="text-sm font-semibold">Overrides activos — revocar uno</h3>
            <ul className="space-y-2 text-sm">
              {overrides.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2"
                >
                  <div>
                    <BadgeInline mode={o.mode} />
                    <span className="ml-2 text-muted-foreground">{o.reason ?? '—'}</span>
                    <div className="text-xs text-muted-foreground">
                      hasta {o.endsAt ? new Date(o.endsAt).toLocaleString() : '∞'} · creado{' '}
                      {new Date(o.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        try {
                          await adminRevokeManualOverrideAction(o.id)
                          toast.success('Override revocado')
                          refresh()
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Error')
                        }
                      })
                    }}
                  >
                    Revocar
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}

function BadgeInline({ mode }: { mode: string }) {
  return (
    <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium">{mode}</span>
  )
}
