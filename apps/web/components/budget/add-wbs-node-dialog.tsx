'use client'

import { useState, useTransition, useMemo, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { addWbsNode } from '@/app/actions/wbs'
import { Loader2, Package } from 'lucide-react'

export type WbsTemplateForLibrary = {
  id: string
  name: string
  code: string
  unit: string
  hasResources: boolean
}

interface AddWbsNodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  parentId: string | null
  parentCode?: string
  parentName?: string
  budgetVersionId?: string
  wbsTemplates?: WbsTemplateForLibrary[]
}

const MAX_SUGGESTIONS = 5

const units = [
  'un', 'm', 'm2', 'm3', 'kg', 'tn', 'h', 'día', 'gl', 'bolsa', 'l',
]

/** Deduplicate by name (case insensitive), keep first occurrence. */
function deduplicateByName(
  templates: WbsTemplateForLibrary[]
): WbsTemplateForLibrary[] {
  const seen = new Set<string>()
  return templates.filter((t) => {
    const key = t.name.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Score: 0 = no match, higher = better (starts with query > contains). */
function matchScore(name: string, query: string): number {
  const n = name.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (n.startsWith(q)) return 10
  if (n.includes(q)) return 5
  return 0
}

export function AddWbsNodeDialog({
  open,
  onOpenChange,
  projectId,
  parentId,
  parentCode,
  parentName,
  budgetVersionId,
  wbsTemplates = [],
}: AddWbsNodeDialogProps) {
  const t = useTranslations('wbs')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [unit, setUnit] = useState('un')
  const [description, setDescription] = useState('')

  const uniqueTemplates = useMemo(
    () => deduplicateByName(wbsTemplates),
    [wbsTemplates]
  )

  const suggestions = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return []
    return uniqueTemplates
      .map((tm) => ({ tm, score: matchScore(tm.name, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SUGGESTIONS)
      .map(({ tm }) => tm)
  }, [uniqueTemplates, searchQuery])

  const selectedTemplate =
    selectedId != null
      ? uniqueTemplates.find((tm) => tm.id === selectedId) ?? null
      : null

  const isCustom =
    searchQuery.trim() !== '' &&
    (selectedTemplate == null || selectedTemplate.name !== searchQuery.trim())

  const canAdd =
    searchQuery.trim() !== '' &&
    (selectedTemplate != null || isCustom)

  useEffect(() => {
    if (selectedTemplate) {
      setUnit(selectedTemplate.unit)
    }
  }, [selectedTemplate])

  function handleSelectTemplate(tm: WbsTemplateForLibrary) {
    setSelectedId(tm.id)
    setSearchQuery(tm.name)
    setUnit(tm.unit)
    setShowSuggestions(false)
  }

  function handleInputChange(value: string) {
    setSearchQuery(value)
    setSelectedId(null)
    setShowSuggestions(true)
  }

  function handleAdd() {
    if (!searchQuery.trim()) {
      toast.error(t('error'), { description: t('enterName') })
      return
    }

    if (selectedTemplate && !isCustom) {
      startTransition(async () => {
        try {
          const result = await addWbsNode({
            projectId,
            parentId,
            templateId: selectedTemplate.id,
            budgetVersionId: budgetVersionId ?? undefined,
          })
          if (result.success) {
            toast.success(t('nodeAdded'), { description: t('nodeAddedDesc') })
            onOpenChange(false)
            router.refresh()
            resetForm()
          } else {
            toast.error(t('error'), {
              description: result.error ?? t('addNodeError'),
            })
          }
        } catch {
          toast.error(t('error'), { description: t('addNodeError') })
        }
      })
      return
    }

    startTransition(async () => {
      try {
        const result = await addWbsNode({
          projectId,
          parentId,
          budgetVersionId: budgetVersionId ?? undefined,
          customData: {
            name: searchQuery.trim(),
            unit,
            description: description.trim() || undefined,
          },
        })
        if (result.success) {
          toast.success(t('nodeAdded'), { description: t('nodeAddedDesc') })
          onOpenChange(false)
          router.refresh()
          resetForm()
        } else {
          toast.error(t('error'), {
            description: result.error ?? t('addNodeError'),
          })
        }
      } catch {
        toast.error(t('error'), { description: t('addNodeError') })
      }
    })
  }

  function resetForm() {
    setSearchQuery('')
    setSelectedId(null)
    setUnit('un')
    setDescription('')
    setShowSuggestions(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{t('addNewTask')}</DialogTitle>
          <DialogDescription>
            {parentName != null && parentName !== '' ? (
              <>{t('addingUnder')}: <strong>{parentCode}</strong> - {parentName}</>
            ) : (
              t('addingAtRoot')
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Label className="sr-only">{t('searchTasks')}</Label>
            <Input
              ref={inputRef}
              placeholder={t('searchOrCustomPlaceholder')}
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowSuggestions(false), 150)
              }}
              disabled={isPending}
              className="h-10 w-full pr-3 text-base"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-52 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                {suggestions.map((tm) => (
                  <button
                    key={tm.id}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelectTemplate(tm)
                    }}
                    className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
                  >
                    <span className="font-medium">{tm.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {tm.unit}
                      </span>
                      {tm.hasResources && (
                        <Badge variant="secondary" className="text-xs">
                          <Package className="mr-0.5 h-3 w-3" />
                          APU
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="unit" className="text-sm">
                {t('unit')} *
              </Label>
              <Select
                value={unit}
                onValueChange={setUnit}
                disabled={isPending}
              >
                <SelectTrigger id="unit" className="mt-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description" className="text-sm">
                {t('description')}
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                disabled={isPending}
                className="mt-1 min-h-[72px] resize-none text-sm"
                rows={2}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isPending || !canAdd}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('adding')}
              </>
            ) : (
              t('add')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
