'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import { ThemeToggle } from '@/components/theme-toggle'
import { LoginBrandingSvg } from '@/components/auth/login-branding-svg'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

type AuthTab = 'login' | 'register'

type LoginPageCardProps = {
  initialTab?: AuthTab
}

export function LoginPageCard({ initialTab = 'login' }: LoginPageCardProps) {
  const t = useTranslations('auth')
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const year = new Date().getFullYear()

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-6">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-xl md:flex-row">
        {/* Columna izquierda: formulario (fondo según tema) */}
        <div className="flex flex-1 flex-col bg-background md:w-[45%] md:min-w-[320px]">
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
                  <div className="mt-4 space-y-3">
                    <Button
                      type="button"
                      onClick={() => setTab('register')}
                      className="h-12 w-full rounded-lg bg-auth-primary text-base font-medium text-auth-primary-foreground hover:bg-auth-primary-hover dark:bg-auth-primary dark:hover:bg-auth-primary-hover dark:text-auth-primary-foreground"
                    >
                      {t('signUp')}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      {t('noAccount', { defaultValue: '¿No tienes cuenta?' })}
                    </p>
                  </div>
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

        {/* Columna derecha: branding (fondo navy, SVG + texto) */}
        <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-navy px-6 py-10 text-primary-foreground md:w-[55%] md:px-12 md:py-16 lg:px-16">
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
    </div>
  )
}
