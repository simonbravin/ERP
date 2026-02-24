'use client'

import Link from 'next/link'
import { usePathname } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  List,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  FileCheck,
  PieChart,
  ShoppingCart,
} from 'lucide-react'

const TAB_LABELS = {
  dashboard: 'Dashboard',
  transactions: 'Transacciones',
  accountsPayable: 'Cuentas por pagar',
  accountsReceivable: 'Cuentas por cobrar',
  overhead: 'Generales',
  purchaseOrders: 'Órdenes de compra',
  cashflow: 'Cashflow',
  cashProjection: 'Proyección de caja',
  certifications: 'Certificaciones',
} as const

export function ProjectFinanceTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const base = `/projects/${projectId}/finance`

  const tabs = [
    { href: base, label: TAB_LABELS.dashboard, icon: LayoutDashboard },
    { href: `${base}/transactions`, label: TAB_LABELS.transactions, icon: List },
    { href: `${base}/accounts-payable`, label: TAB_LABELS.accountsPayable, icon: ArrowDownCircle },
    { href: `${base}/accounts-receivable`, label: TAB_LABELS.accountsReceivable, icon: ArrowUpCircle },
    { href: `${base}/overhead`, label: TAB_LABELS.overhead, icon: PieChart },
    { href: `${base}/purchase-orders`, label: TAB_LABELS.purchaseOrders, icon: ShoppingCart },
    { href: `${base}/cashflow`, label: TAB_LABELS.cashflow, icon: TrendingUp },
    { href: `${base}/cash-projection`, label: TAB_LABELS.cashProjection, icon: Calendar },
    { href: `${base}/certifications`, label: TAB_LABELS.certifications, icon: FileCheck },
  ]

  return (
    <nav className="flex gap-1 rounded-lg border border-border bg-muted/50 p-1">
      {tabs.map((tab) => {
        const isActive =
          pathname === tab.href || (tab.href !== base && pathname.startsWith(tab.href))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
