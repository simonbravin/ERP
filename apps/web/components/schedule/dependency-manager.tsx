'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { addTaskDependency, removeTaskDependency } from '@/app/actions/schedule'
import { Loader2, Trash2, Plus, ArrowRight } from 'lucide-react'

interface DependencyManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  taskId: string
  taskName: string
  canEdit?: boolean
  availableTasks: Array<{
    id: string
    code: string
    name: string
  }>
  existingDependencies: Array<{
    id: string
    predecessorId: string
    predecessorName: string
    successorId: string
    successorName: string
    type: 'FS' | 'SS' | 'FF' | 'SF'
    lagDays: number
  }>
}

export function DependencyManager({
  open,
  onOpenChange,
  scheduleId,
  taskId,
  taskName,
  canEdit = true,
  availableTasks,
  existingDependencies,
}: DependencyManagerProps) {
  const t = useTranslations('schedule')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedTask, setSelectedTask] = useState<string>('')
  const [dependencyType, setDependencyType] = useState<'FS' | 'SS' | 'FF' | 'SF'>(
    'FS'
  )
  const [lagDays, setLagDays] = useState<number>(0)

  const dependencyTypes = [
    {
      value: 'FS',
      label: t('finishToStart'),
      description: 'B inicia cuando A termina',
    },
    {
      value: 'SS',
      label: t('startToStart'),
      description: 'B inicia cuando A inicia',
    },
    {
      value: 'FF',
      label: t('finishToFinish'),
      description: 'B termina cuando A termina',
    },
    {
      value: 'SF',
      label: t('startToFinish'),
      description: 'B termina cuando A inicia',
    },
  ]

  const availableForDependency = availableTasks.filter(
    (task) =>
      task.id !== taskId &&
      !existingDependencies.some(
        (dep) => dep.successorId === taskId && dep.predecessorId === task.id
      )
  )

  function handleAddDependency() {
    if (!selectedTask) {
      toast.error(t('selectTaskFirst'))
      return
    }

    startTransition(async () => {
      try {
        const result = await addTaskDependency({
          scheduleId,
          predecessorId: selectedTask,
          successorId: taskId,
          dependencyType,
          lagDays,
        })

        if (result.success) {
          toast.success(t('dependencyAddedDesc'))
          router.refresh()
          setSelectedTask('')
          setDependencyType('FS')
          setLagDays(0)
        } else {
          toast.error(result.error || t('dependencyAddError'))
        }
      } catch {
        toast.error(t('dependencyAddError'))
      }
    })
  }

  function handleRemoveDependency(dependencyId: string) {
    startTransition(async () => {
      try {
        const result = await removeTaskDependency(dependencyId)
        if (result.success) {
          toast.success(t('dependencyRemovedDesc'))
          router.refresh()
        } else {
          toast.error(result.error || t('dependencyRemoveError'))
        }
      } catch {
        toast.error(t('dependencyRemoveError'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>{t('manageDependencies')}</DialogTitle>
          <DialogDescription>
            {t('taskLabel')}: <strong>{taskName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              {t('currentDependencies')}
            </h3>
            {existingDependencies.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('noDependenciesYet')}
              </p>
            ) : (
              <div className="space-y-2">
                {existingDependencies.map((dep) => {
                  const isPredecessor = dep.successorId === taskId
                  const relatedTask = isPredecessor
                    ? dep.predecessorName
                    : dep.successorName
                  return (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={isPredecessor ? 'default' : 'secondary'}
                        >
                          {isPredecessor
                            ? t('predecessor')
                            : t('successor')}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {relatedTask}
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-400" />
                          <Badge variant="outline">{dep.type}</Badge>
                          {dep.lagDays !== 0 && (
                            <span className="text-xs text-slate-500">
                              {dep.lagDays > 0
                                ? `+${dep.lagDays}d`
                                : `${dep.lagDays}d`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDependency(dep.id)}
                        disabled={isPending || !canEdit}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-semibold">
              {t('addNewDependency')}
            </h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="predecessor">
                  {t('predecessorTask')}
                </Label>
                <Select
                  value={selectedTask}
                  onValueChange={setSelectedTask}
                  disabled={isPending || !canEdit}
                >
                  <SelectTrigger id="predecessor" className="mt-1 w-full">
                    <SelectValue placeholder={t('selectTask')} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableForDependency.length === 0 ? (
                      <div className="p-2 text-sm text-slate-500">
                        {t('noTasksAvailable')}
                      </div>
                    ) : (
                      availableForDependency.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.code} - {task.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="depType">{t('dependencyType')}</Label>
                  <Select
                    value={dependencyType}
                    onValueChange={(v) =>
                      setDependencyType(v as 'FS' | 'SS' | 'FF' | 'SF')
                    }
                    disabled={isPending || !canEdit}
                  >
                    <SelectTrigger id="depType" className="mt-1 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dependencyTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div>
                            <p className="font-medium">{type.label}</p>
                            <p className="text-xs text-slate-500">
                              {type.description}
                            </p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="lag">
                    {t('lagDays')}
                    <span className="ml-1 text-xs text-slate-500">
                      ({t('lagHint')})
                    </span>
                  </Label>
                  <Input
                    id="lag"
                    type="number"
                    value={lagDays}
                    onChange={(e) =>
                      setLagDays(parseInt(e.target.value, 10) || 0)
                    }
                    disabled={isPending || !canEdit}
                    className="mt-1 w-full"
                  />
                </div>
              </div>

              <Button
                onClick={handleAddDependency}
                disabled={isPending || !selectedTask || !canEdit}
                className="w-full"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('adding')}
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    {t('addDependency')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
