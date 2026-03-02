'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginBrandingSvg } from '@/components/auth/login-branding-svg'
import { useTranslations } from 'next-intl'

type AuthTab = 'login' | 'register'

type LoginPageCardProps = {
  initialTab?: AuthTab
}

export function LoginPageCard({ initialTab = 'login' }: LoginPageCardProps) {
  const t = useTranslations('auth')
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* Columna izquierda: formulario (pantalla completa) */}
      <div className="flex flex-1 flex-col bg-background md:w-[45%] md:min-w-[320px] md:rounded-r-2xl md:overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4">
          <a
            href="https://bloqer.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            aria-label="Ir a bloqer.app"
          >
            <Image src="/icon" alt="Bloqer" width={32} height={32} className="h-8 w-8" />
          </a>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 sm:py-12 md:px-12">
          <div className="mx-auto w-full max-w-[380px]">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {t('signInToAccount', { defaultValue: 'Iniciar sesión en tu cuenta' })}
            </h2>

            {tab === 'login' ? (
              <>
                <LoginForm />
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  {t('noAccount', { defaultValue: '¿No tienes cuenta?' })}{' '}
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="font-medium text-auth-primary underline hover:no-underline"
                  >
                    {t('signUp')}
                  </button>
                </p>
              </>
            ) : (
              <RegisterForm
                embedded
                onSwitchToLogin={() => setTab('login')}
              />
            )}
          </div>
        </main>

        <footer className="border-t border-border px-6 py-4">
          <p className="text-xs text-muted-foreground">
            © {year} – Bloqer
          </p>
        </footer>
      </div>

      {/* Columna derecha: branding (pantalla completa, borde redondeado a la izquierda) */}
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-navy px-6 py-10 text-primary-foreground md:w-[55%] md:rounded-l-2xl md:overflow-hidden md:px-12 md:py-16 lg:px-16">
        <LoginBrandingSvg />
        <div className="relative z-10 mx-auto w-full max-w-[380px] text-center">
          <p className="text-base font-medium text-accent sm:text-lg">
            {t('discoverBloqer', { defaultValue: 'Descubre Bloqer hoy' })}
          </p>
          <h3 className="mt-3 text-2xl font-bold leading-snug text-white sm:mt-4 sm:text-3xl md:text-4xl lg:text-[2.25rem]">
            {t('tagline', {
              defaultValue: 'Gestión de obras, en un solo lugar.',
            })}
          </h3>
        </div>
      </div>
    </div>
  )
}
