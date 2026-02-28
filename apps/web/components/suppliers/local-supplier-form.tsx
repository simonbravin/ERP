'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createLocalSupplier } from '@/app/actions/global-suppliers'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().max(100).optional().or(z.literal('')),
  taxId: z.string().max(50).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  website: z
    .string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true
        if (/^https?:\/\//i.test(val)) {
          try {
            new URL(val)
            return true
          } catch {
            return false
          }
        }
        return /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z0-9.-]+$/i.test(val.trim())
      },
      { message: 'Ingrese una URL o un dominio (ej: ejemplo.com)' }
    ),
})
type FormData = z.infer<typeof schema>

export function LocalSupplierForm() {
  const t = useTranslations('suppliers')
  const router = useRouter()
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingData, setPendingData] = useState<FormData | null>(null)
  const [forceSubmitting, setForceSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData, forceCreate = false) {
    try {
      const result = await createLocalSupplier({
        name: data.name,
        category: data.category || undefined,
        taxId: data.taxId || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        website: data.website || undefined,
        forceCreate,
      })
      if (result.success) {
        router.push('/suppliers/list?tab=local')
        router.refresh()
        return
      }
      if (result.duplicateName) {
        setPendingData(data)
        setShowDuplicateDialog(true)
      }
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to create supplier',
      })
    }
  }

  async function handleForceCreate() {
    if (!pendingData) return
    setForceSubmitting(true)
    try {
      await onSubmit(pendingData, true)
      setShowDuplicateDialog(false)
      setPendingData(null)
    } finally {
      setForceSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="name">{t('name')}</Label>
        <Input id="name" {...register('name')} className="mt-1" required />
        {errors.name && (
          <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="category">{t('category')}</Label>
        <Input
          id="category"
          {...register('category')}
          className="mt-1"
          placeholder="ej. MATERIAL, LABOR, EQUIPMENT"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" type="email" {...register('email')} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input id="phone" {...register('phone')} className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="address">{t('address')}</Label>
        <Input id="address" {...register('address')} className="mt-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="city">{t('city')}</Label>
          <Input id="city" {...register('city')} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="country">{t('country')}</Label>
          <Input id="country" {...register('country')} className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="taxId">{t('taxId')}</Label>
        <Input id="taxId" {...register('taxId')} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="website">{t('website')}</Label>
        <Input id="website" type="text" {...register('website')} className="mt-1" placeholder="ejemplo.com" />
      </div>
      {errors.root && (
        <p className="text-sm text-destructive">{errors.root.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '…' : t('createSupplier', { defaultValue: 'Crear proveedor' })}
        </Button>
        <Link href="/suppliers/list?tab=local">
          <Button type="button" variant="outline">
            {t('cancel')}
          </Button>
        </Link>
      </div>

      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="erp-form-modal max-w-md">
          <DialogHeader>
            <DialogTitle>{t('duplicateDialogTitle')}</DialogTitle>
            <DialogDescription>{t('duplicateNameWarning')}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowDuplicateDialog(false)
                setPendingData(null)
              }}
            >
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleForceCreate} disabled={forceSubmitting}>
              {forceSubmitting ? '…' : t('forceCreateAnyway')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
