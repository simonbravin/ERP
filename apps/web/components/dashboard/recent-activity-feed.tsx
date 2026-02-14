'use client'

import { useTranslations } from 'next-intl'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  FolderPlus,
  FileEdit,
  CheckCircle,
  DollarSign,
  FileText,
  AlertCircle,
  User,
} from 'lucide-react'
import type { ActivityItem } from '@/app/actions/dashboard'

interface RecentActivityFeedProps {
  activities: ActivityItem[]
}

/**
 * Recent activity feed showing audit log entries
 */
export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const t = useTranslations('dashboard')

  const getActivityIcon = (action: string, entityType: string) => {
    const key = `${action}_${entityType}`.toUpperCase()

    switch (key) {
      case 'CREATE_PROJECT':
        return { icon: FolderPlus, color: 'bg-green-100 text-green-600' }
      case 'UPDATE_PROJECT':
        return { icon: FileEdit, color: 'bg-blue-100 text-blue-600' }
      case 'APPROVE_BUDGETVERSION':
      case 'APPROVE_CERTIFICATION':
      case 'APPROVE_CHANGEORDER':
        return { icon: CheckCircle, color: 'bg-green-100 text-green-600' }
      case 'CREATE_BUDGETVERSION':
      case 'CREATE_CERTIFICATION':
        return { icon: DollarSign, color: 'bg-yellow-100 text-yellow-600' }
      case 'CREATE_CHANGEORDER':
        return { icon: FileText, color: 'bg-purple-100 text-purple-600' }
      case 'CREATE_RFI':
      case 'UPDATE_RFI':
        return { icon: AlertCircle, color: 'bg-orange-100 text-orange-600' }
      default:
        return { icon: FileEdit, color: 'bg-muted text-muted-foreground' }
    }
  }

  const getActivityLabel = (action: string, entityType: string) => {
    const key = `activity_${action}_${entityType}`.toLowerCase()
    try {
      const translated = t(key)
      if (translated !== key) return translated
    } catch {
      // Fall through to fallback when key is missing
    }
    
    // Fallback: format as readable text
    const actionLabels: Record<string, string> = {
      CREATE: 'creó',
      UPDATE: 'actualizó',
      DELETE: 'eliminó',
      APPROVE: 'aprobó',
      REJECT: 'rechazó',
      ISSUE: 'emitió',
    }

    const entityLabels: Record<string, string> = {
      PROJECT: 'proyecto',
      BUDGETVERSION: 'versión de presupuesto',
      BUDGETLINE: 'partida',
      CERTIFICATION: 'certificación',
      CHANGEORDER: 'orden de cambio',
      RFI: 'RFI',
      SUBMITTAL: 'submittal',
      DOCUMENT: 'documento',
      FINANCETRANSACTION: 'transacción',
      DAILYREPORT: 'reporte de obra',
      SCHEDULE: 'cronograma',
    }

    const actionLabel = actionLabels[action.toUpperCase()] || action.toLowerCase()
    const entityLabel = entityLabels[entityType.toUpperCase()] || entityType.toLowerCase()

    return `${actionLabel} ${entityLabel}`
  }

  return (
    <div className="erp-card p-6">
      <h3 className="erp-section-title">{t('recentActivityTitle')}</h3>

      {activities.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center py-8">
          <div className="rounded-full bg-muted p-3">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('noRecentActivity')}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {activities.map((activity) => {
            const { icon: Icon, color } = getActivityIcon(
              activity.action,
              activity.entityType
            )

            return (
              <div
                key={activity.id}
                className="erp-row-interactive flex items-start gap-4 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">{activity.actorName}</span>
                    {' '}
                    {getActivityLabel(activity.action, activity.entityType)}
                    {activity.projectName && (
                      <>
                        {' '}en{' '}
                        <span className="font-medium">{activity.projectName}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
