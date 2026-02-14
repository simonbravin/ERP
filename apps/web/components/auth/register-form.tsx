'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { registerSchema, type RegisterInput } from '@repo/validators'
import { register as registerAction } from '@/app/actions/auth'
import { COUNTRIES } from '@/lib/countries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'
import { Controller } from 'react-hook-form'

type RegisterFormProps = {
  /** Cuando se usa dentro del card de login, cambia a vista login sin navegar */
  onSwitchToLogin?: () => void
  /** Si true, no mostrar padding/card propio (ya está dentro del card) */
  embedded?: boolean
}

export function RegisterForm({ onSwitchToLogin, embedded }: RegisterFormProps) {
  const t = useTranslations('auth')
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      fullName: '',
      email: '',
      password: '',
      passwordConfirm: '',
      country: '',
      city: '',
      phone: '',
      orgName: '',
    },
  })

  async function onSubmit(data: RegisterInput) {
    const result = await registerAction(data)
    if (result?.error) {
      const err = result.error as {
        _form?: string[]
        username?: string[]
        email?: string[]
        password?: string[]
        passwordConfirm?: string[]
        fullName?: string[]
        orgName?: string[]
        country?: string[]
        city?: string[]
        phone?: string[]
      }
      if (err._form) setError('root', { message: err._form[0] })
      if (err.username) setError('username', { message: err.username[0] })
      if (err.email) setError('email', { message: err.email[0] })
      if (err.password) setError('password', { message: err.password[0] })
      if (err.passwordConfirm)
        setError('passwordConfirm', { message: err.passwordConfirm[0] })
      if (err.fullName) setError('fullName', { message: err.fullName[0] })
      if (err.orgName) setError('orgName', { message: err.orgName[0] })
      if (err.country) setError('country', { message: err.country[0] })
      if (err.city) setError('city', { message: err.city[0] })
      if (err.phone) setError('phone', { message: err.phone[0] })
      return
    }
  }

  const formContent = (
    <>
      {!embedded && (
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('createAccount')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('registerOrg')}
          </p>
        </div>
      )}
      {errors.root && (
        <p className="text-sm text-destructive" role="alert">
          {errors.root.message}
        </p>
      )}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Fila 1: Usuario | Nombre completo */}
        <div className="space-y-2">
          <Label htmlFor="username">{t('username')}</Label>
          <Input
            id="username"
            type="text"
            autoComplete="username"
            placeholder={t('usernamePlaceholder')}
            {...register('username')}
          />
          {errors.username && (
            <p className="text-sm text-destructive">
              {errors.username.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName">{t('fullName')}</Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder={t('fullNamePlaceholder')}
            {...register('fullName')}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">
              {errors.fullName.message}
            </p>
          )}
        </div>
        {/* Fila 2: Empresa | Email */}
        <div className="space-y-2">
          <Label htmlFor="orgName">{t('orgName')}</Label>
          <Input
            id="orgName"
            type="text"
            autoComplete="organization"
            placeholder={t('orgNamePlaceholder')}
            {...register('orgName')}
          />
          {errors.orgName && (
            <p className="text-sm text-destructive">
              {errors.orgName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t('email')}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t('emailPlaceholder')}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">
              {errors.email.message}
            </p>
          )}
        </div>
        {/* Fila 3: País | Ciudad */}
        <div className="space-y-2">
          <Label htmlFor="country">{t('country')}</Label>
          <Controller
            name="country"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger id="country">
                  <SelectValue placeholder={t('countryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.country && (
            <p className="text-sm text-destructive">
              {errors.country.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">{t('city')}</Label>
          <Input
            id="city"
            type="text"
            autoComplete="address-level2"
            placeholder={t('cityPlaceholder')}
            {...register('city')}
          />
          {errors.city && (
            <p className="text-sm text-destructive">
              {errors.city.message}
            </p>
          )}
        </div>
        {/* Fila 4: Teléfono (columna izquierda; ERD: OrgProfile.phone) */}
        <div className="space-y-2">
          <Label htmlFor="phone">{t('phone')}</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            {...register('phone')}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">
              {errors.phone.message}
            </p>
          )}
        </div>
        <div className="hidden sm:block" aria-hidden />
        {/* Fila 5: Contraseña | Confirmar contraseña (última fila, misma fila) */}
        <div className="space-y-2">
          <Label htmlFor="password">{t('password')}</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder={t('passwordMinPlaceholder')}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="passwordConfirm">{t('confirmPassword')}</Label>
          <Input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            placeholder={t('confirmPasswordPlaceholder')}
            {...register('passwordConfirm')}
          />
          {errors.passwordConfirm && (
            <p className="text-sm text-destructive">
              {errors.passwordConfirm.message}
            </p>
          )}
        </div>
      </div>
      <Button type="submit" className="w-full" variant="accent" disabled={isSubmitting}>
        {isSubmitting ? t('creatingAccount') : t('createAccountButton')}
      </Button>
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        {t('hasAccount')}{' '}
        {onSwitchToLogin ? (
          <button
            type="button"
            className="font-medium text-auth-primary underline hover:no-underline"
            onClick={onSwitchToLogin}
          >
            {t('signIn')}
          </button>
        ) : (
          <Link
            href="/login"
            className="font-medium text-gray-900 underline hover:no-underline dark:text-white"
          >
            {t('signIn')}
          </Link>
        )}
      </p>
    </>
  )

  if (embedded) {
    return (
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {formContent}
      </form>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full min-w-0 max-w-[44rem] space-y-6 rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-900 sm:min-w-[24rem] md:p-10"
    >
      {formContent}
    </form>
  )
}
