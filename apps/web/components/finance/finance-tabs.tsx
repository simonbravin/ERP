'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, List, TrendingUp, PieChart, ArrowDownCircle, ArrowUpCircle, Calendar } from 'lucide-react'

const tabs = [
  { href: '/finance', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/finance/transactions', label: 'Transacciones', icon: List },
  { href: '/finance/accounts-payable', label: 'Cuentas por pagar', icon: ArrowDownCircle },
  { href: '/finance/accounts-receivable', label: 'Cuentas por cobrar', icon: ArrowUpCircle },
  { href: '/finance/cashflow', label: 'Cashflow', icon: TrendingUp },
  { href: '/finance/cash-projection', label: 'Proyección de caja', icon: Calendar },
  { href: '/finance/overhead', label: 'Overhead', icon: PieChart },
]

export function FinanceTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href !== '/finance' && pathname.startsWith(tab.href))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
