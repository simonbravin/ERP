import type { Metadata } from 'next'
import { Inter, Roboto_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from 'sonner'
import { SystemHealthWidgetGate } from '@/components/debug/system-health-widget-gate'
import { GlobalNotificationsListener } from '@/components/global-notifications-listener'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  variable: '--font-roboto-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bloqer',
  description: 'Bloqer — SaaS multi-tenant para gestión de construcción',
  icons: { icon: '/icon' },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${robotoMono.variable}`}
    >
      <body className="erp-shell antialiased font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
          <GlobalNotificationsListener />
          <SystemHealthWidgetGate />
        </ThemeProvider>
      </body>
    </html>
  )
}
