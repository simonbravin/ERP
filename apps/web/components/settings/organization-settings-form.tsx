'use client'

import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  updateOrganizationSchema,
  type UpdateOrganizationInput,
} from '@repo/validators'
import { updateOrganization, uploadOrgLogo, removeOrgLogo } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Trash2 } from 'lucide-react'
import { FileAndCameraTrigger } from '@/components/ui/file-and-camera-trigger'

interface OrganizationSettingsFormProps {
  organization: {
    id: string
    name: string
    slug: string
    taxId: string | null
    country: string | null
    city: string | null
    address: string | null
  }
  profile: {
    legalName: string
    taxId: string | null
    address: string | null
    city: string | null
    country: string | null
    phone: string | null
    email: string | null
    website: string | null
    baseCurrency: string
    defaultTaxPct: number
    documentFooterText: string | null
  } | null
  logoUrl?: string | null
}

export function OrganizationSettingsForm({
  organization,
  profile,
  logoUrl,
}: OrganizationSettingsFormProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isRemovingLogo, setIsRemovingLogo] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: {
      name: organization.name,
      legalName: profile?.legalName || organization.name,
      taxId: profile?.taxId || organization.taxId || '',
      address: profile?.address || organization.address || '',
      city: profile?.city || organization.city || '',
      country: profile?.country || organization.country || '',
      phone: profile?.phone || '',
      email: profile?.email || '',
      website: profile?.website || '',
      baseCurrency: profile?.baseCurrency || 'ARS',
      defaultTaxPct: profile?.defaultTaxPct ?? 21,
      documentFooterText: profile?.documentFooterText || '',
    },
  })

  async function onSubmit(data: UpdateOrganizationInput) {
    setIsSubmitting(true)
    try {
      const result = await updateOrganization(data)
      if (result.success) {
        toast.success(t('organizationUpdated'))
        router.refresh()
      } else {
        toast.error(result.error || t('errorUpdating'))
      }
    } catch {
      toast.error(t('errorUpdating'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRemoveLogo() {
    setIsRemovingLogo(true)
    try {
      const result = await removeOrgLogo()
      if (result.success) {
        toast.success(t('logoRemoved', { defaultValue: 'Logo eliminado' }))
        router.refresh()
      } else {
        toast.error(result.error || t('errorUpdating'))
      }
    } catch {
      toast.error(t('errorUpdating'))
    } finally {
      setIsRemovingLogo(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full min-w-0 space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900">{t('companyLogo')}</h3>
        <div className="flex flex-wrap items-end gap-6">
          {logoUrl ? (
            <div className="flex items-center gap-4">
              <Image
                src={logoUrl}
                alt={organization.name}
                width={200}
                height={64}
                className="h-16 w-auto max-w-[200px] rounded border border-slate-200 object-contain bg-white p-1"
                unoptimized
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemoveLogo}
                disabled={isRemovingLogo}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isRemovingLogo ? t('saving') : t('removeLogo', { defaultValue: 'Eliminar logo' })}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">{t('noLogo', { defaultValue: 'No hay logo cargado' })}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <FileAndCameraTrigger
              imagesOnly
              onFileSelect={async (file) => {
                setIsUploadingLogo(true)
                try {
                  const formData = new FormData()
                  formData.set('logo', file)
                  const result = await uploadOrgLogo(formData)
                  if (result.success) {
                    toast.success(t('logoUploaded', { defaultValue: 'Logo actualizado' }))
                    router.refresh()
                  } else {
                    toast.error(result.error || t('errorUpdating'))
                  }
                } catch {
                  toast.error(t('errorUpdating'))
                } finally {
                  setIsUploadingLogo(false)
                }
              }}
              loading={isUploadingLogo}
              uploadLabel={isUploadingLogo ? t('saving') : t('uploadLogo', { defaultValue: 'Subir logo' })}
              cameraLabel={tCommon('takePhoto')}
              t={tCommon}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {(() => {
            try {
              return t('logoHelp')
            } catch {
              return 'PNG, JPG, GIF o WebP. Máximo 5 MB. Se muestra en la barra lateral.'
            }
          })()}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900">{t('basicInfo')}</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">{t('organizationName')}</Label>
            <Input
              id="name"
              {...register('name')}
              className="mt-1 w-full min-w-0"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="legalName">{t('legalName')}</Label>
            <Input
              id="legalName"
              {...register('legalName')}
              className="mt-1 w-full"
            />
            <p className="mt-1 text-xs text-slate-500">{t('legalNameHelp')}</p>
          </div>
          <div>
            <Label htmlFor="taxId">{t('taxId')}</Label>
            <Input
              id="taxId"
              {...register('taxId')}
              placeholder="30-12345678-9"
              className="mt-1 w-full"
            />
          </div>
          <div>
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input
              id="phone"
              type="tel"
              {...register('phone')}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className="mt-1 w-full"
            />
          </div>
          <div>
            <Label htmlFor="website">{t('website')}</Label>
            <Input
              id="website"
              type="text"
              {...register('website')}
              placeholder="ejemplo.com o https://ejemplo.com"
              className="mt-1 w-full"
            />
            {errors.website && (
              <p className="mt-1 text-sm text-destructive">{errors.website.message}</p>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="slug">{t('slug')}</Label>
          <Input
            id="slug"
            value={organization.slug}
            disabled
            className="mt-1 w-full bg-slate-50"
          />
          <p className="mt-1 text-xs text-slate-500">{t('slugNotEditable')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900">{t('address')}</h3>
        <div>
          <Label htmlFor="address">{t('streetAddress')}</Label>
          <Input id="address" {...register('address')} className="mt-1 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">{t('city')}</Label>
            <Input id="city" {...register('city')} className="mt-1 w-full" />
          </div>
          <div>
            <Label htmlFor="country">{t('country')}</Label>
            <Input id="country" {...register('country')} className="mt-1 w-full" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900">
          {t('regionalSettings')}
        </h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="baseCurrency">{t('baseCurrency')}</Label>
            <Select
              value={watch('baseCurrency')}
              onValueChange={(value) => setValue('baseCurrency', value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARS">ARS - Peso Argentino</SelectItem>
                <SelectItem value="USD">USD - Dólar Estadounidense</SelectItem>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="BRL">BRL - Real Brasileño</SelectItem>
                <SelectItem value="CLP">CLP - Peso Chileno</SelectItem>
                <SelectItem value="COP">COP - Peso Colombiano</SelectItem>
                <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="defaultTaxPct">{t('defaultTaxPct')}</Label>
            <Input
              id="defaultTaxPct"
              type="number"
              step="0.01"
              {...register('defaultTaxPct', { valueAsNumber: true })}
              placeholder="21.00"
              className="mt-1 w-full"
            />
            <p className="mt-1 text-xs text-slate-500">{t('defaultTaxPctHelp')}</p>
            {errors.defaultTaxPct && (
              <p className="mt-1 text-sm text-destructive">
                {errors.defaultTaxPct.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-medium text-slate-900">
          {t('documentSettings')}
        </h3>
        <div>
          <Label htmlFor="documentFooterText">{t('documentFooter')}</Label>
          <Textarea
            id="documentFooterText"
            {...register('documentFooterText')}
            rows={3}
            placeholder={t('documentFooterPlaceholder', {
              defaultValue: 'Texto que aparecerá al pie de facturas y presupuestos',
            })}
            className="mt-1 w-full"
          />
          <p className="mt-1 text-xs text-slate-500">
            {t('documentFooterHint', {
              defaultValue: 'Opcional. Se incluye en documentos PDF generados.',
            })}
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('saveChanges')}
        </Button>
      </div>
    </form>
  )
}
