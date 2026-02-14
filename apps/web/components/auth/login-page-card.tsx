'use client'

import { useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  FileSpreadsheet,
  TrendingUp,
  CalendarCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const features = [
  { icon: LayoutDashboard, textKey: 'featureDashboard' as const },
  { icon: FileSpreadsheet, textKey: 'featureBudget' as const },
  { icon: TrendingUp, textKey: 'featureCertifications' as const },
  { icon: CalendarCheck, textKey: 'featureGantt' as const },
] as const

type AuthTab = 'login' | 'register'

type LoginPageCardProps = {
  /** Si viene de /register, mostrar formulario de registro por defecto */
  initialTab?: AuthTab
}

export function LoginPageCard({ initialTab = 'login' }: LoginPageCardProps) {
  const t = useTranslations('auth')
  const [tab, setTab] = useState<AuthTab>(initialTab)

  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-card shadow-xl md:flex md:min-h-[520px]">
      {/* Left: Brand — bloque centrado en la vista, texto alineado a la izquierda (estética VBT) */}
      <div className="flex flex-col justify-center px-10 py-12 text-primary-foreground bg-auth-primary md:w-[45%] md:min-w-[280px] md:px-12 md:py-14">
        <div className="mx-auto w-full max-w-[20rem] text-left">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Construction ERP
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/90 md:text-base">
            La plataforma profesional para gestión de presupuestos y seguimiento
            de obras de construcción.
          </p>
          <ul className="mt-8 space-y-4">
            {features.map(({ icon: Icon, textKey }) => (
              <li key={textKey} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm text-primary-foreground/95 md:text-base">
                  {t(textKey)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: Form */}
      <div className="flex flex-col justify-center px-8 py-10 md:w-[55%] md:px-10 md:py-12">
        <div className="mb-8 flex rounded-lg border border-border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`flex flex-1 items-center justify-center rounded-md py-2.5 text-sm font-medium transition ${
              tab === 'login'
                ? 'border border-accent bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('signIn')}
          </button>
          <button
            type="button"
            onClick={() => setTab('register')}
            className={`flex flex-1 items-center justify-center rounded-md py-2.5 text-sm font-medium transition ${
              tab === 'register'
                ? 'border border-accent bg-accent/10 text-accent'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('signUp')}
          </button>
        </div>

        {tab === 'login' ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-lg border-border bg-background"
              disabled
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('continueWithGoogle')}
            </Button>
            <div className="my-8 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">
                {t('orSignInWithAccount')}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <LoginForm />
          </>
        ) : (
          <RegisterForm
            embedded
            onSwitchToLogin={() => setTab('login')}
          />
        )}
      </div>
    </div>
  )
}
