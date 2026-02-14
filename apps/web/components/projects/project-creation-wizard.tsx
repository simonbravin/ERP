'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createProjectFromTemplate } from '@/app/actions/projects'
import { createProjectSchema } from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { CheckCircle2, ChevronRight, Building2, Home, Bath } from 'lucide-react'

interface ProjectTemplate {
  id: string
  name: string
  description: string | null
  category: string
}

interface ConstructionSystem {
  id: string
  name: string
  description: string | null
}

interface ProjectCreationWizardProps {
  templates: ProjectTemplate[]
  constructionSystems: ConstructionSystem[]
}

const templateIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'template-obra-publica': Building2,
  'template-obra-privada': Home,
  'template-ampliacion-cocina': Home,
  'template-ampliacion-bano': Bath,
}

export function ProjectCreationWizard({
  templates,
  constructionSystems,
}: ProjectCreationWizardProps) {
  const t = useTranslations('projects')
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedSystems, setSelectedSystems] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      clientName: '',
      location: '',
      description: '',
      m2: '',
      startDate: '',
    },
  })

  async function onSubmit(data: Record<string, unknown>) {
    if (!selectedTemplate) {
      toast.error('Debes seleccionar un template')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createProjectFromTemplate({
        name: data.name as string,
        clientName: (data.clientName as string) || undefined,
        location: (data.location as string) || undefined,
        description: (data.description as string) || undefined,
        m2: data.m2 ? parseFloat(String(data.m2)) : null,
        startDate: (data.startDate as string) || undefined,
        templateId: selectedTemplate,
        constructionSystemIds: selectedSystems,
      })

      if (result.success && result.projectId) {
        toast.success(t('projectCreated', { defaultValue: 'Proyecto creado' }), {
          description: t('projectCreatedDesc', { defaultValue: 'El proyecto se creó correctamente' }),
        })
        router.push(`/projects/${result.projectId}`)
      } else {
        toast.error(result.error || t('projectCreationError', { defaultValue: 'Error al crear' }))
      }
    } catch {
      toast.error(t('projectCreationError', { defaultValue: 'Error al crear' }))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        {[1, 2, 3].map((stepNumber) => (
          <div key={stepNumber} className="flex items-center">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                step >= stepNumber
                  ? 'erp-wizard-step-dot-active'
                  : 'erp-wizard-step-dot-inactive'
              }`}
            >
              {step > stepNumber ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                stepNumber
              )}
            </div>
            <div className="ml-3">
              <p
                className={`erp-wizard-step-label ${
                  step >= stepNumber
                    ? 'erp-wizard-step-label-active'
                    : 'erp-wizard-step-label-disabled'
                }`}
              >
                {stepNumber === 1 && 'Seleccionar Template'}
                {stepNumber === 2 && 'Sistema Constructivo'}
                {stepNumber === 3 && 'Datos del Proyecto'}
              </p>
            </div>
            {stepNumber < 3 && (
              <ChevronRight className="erp-wizard-step-separator mx-4 hidden h-5 w-5 sm:block" />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <div className="erp-section-header">
            <h2 className="erp-section-title">
              Selecciona el tipo de proyecto
            </h2>
            <p className="erp-section-desc">
              El template determina la estructura WBS predefinida
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templates.map((template) => {
              const Icon = templateIcons[template.id] || Building2
              const isSelected = selectedTemplate === template.id

              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-all erp-card-selectable ${
                    isSelected ? 'erp-card-selected' : ''
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Icon className="h-8 w-8 text-primary" />
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <CardTitle className="mt-2">{template.name}</CardTitle>
                    <CardDescription>
                      {template.description || 'Template estándar'}
                    </CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => setStep(2)}
              disabled={!selectedTemplate}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="erp-section-header">
            <h2 className="erp-section-title">
              Selecciona el sistema constructivo
            </h2>
            <p className="erp-section-desc">
              Puedes seleccionar múltiples sistemas. Esto filtrará los items del WBS.
            </p>
          </div>

          <div className="space-y-3">
            {constructionSystems.map((system) => {
              const isSelected = selectedSystems.includes(system.id)

              return (
                <Card
                  key={system.id}
                  className={`cursor-pointer transition-all erp-card-selectable ${
                    isSelected ? 'erp-card-selected' : ''
                  }`}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSystems(selectedSystems.filter((id) => id !== system.id))
                    } else {
                      setSelectedSystems([...selectedSystems, system.id])
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="flex-1">
                      <CardTitle className="text-base">{system.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {system.description}
                      </CardDescription>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    )}
                  </CardHeader>
                </Card>
              )
            })}

            <Card
              className={`cursor-pointer transition-all erp-card-selectable ${
                selectedSystems.includes('generic') ? 'erp-card-selected' : ''
              }`}
              onClick={() => {
                if (selectedSystems.includes('generic')) {
                  setSelectedSystems(selectedSystems.filter((id) => id !== 'generic'))
                } else {
                  setSelectedSystems([...selectedSystems, 'generic'])
                }
              }}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex-1">
                  <CardTitle className="text-base">Genérico / Otro</CardTitle>
                  <CardDescription className="mt-1">
                    No filtrar por sistema, incluir todos los items
                  </CardDescription>
                </div>
                {selectedSystems.includes('generic') && (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                )}
              </CardHeader>
            </Card>
          </div>

          <div className="flex justify-between gap-4">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Atrás
            </Button>
            <Button type="button" onClick={() => setStep(3)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="erp-section-header">
            <h2 className="erp-section-title">
              Completa los datos del proyecto
            </h2>
            <p className="erp-section-desc">
              Información básica para crear el proyecto
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="name">{t('projectName')} *</Label>
                <Input
                  id="name"
                  {...form.register('name')}
                  className="mt-1"
                  placeholder="Ej: Ampliación Casa Rodriguez"
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="clientName">{t('clientName')}</Label>
                <Input
                  id="clientName"
                  {...form.register('clientName')}
                  className="mt-1"
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <Label htmlFor="location">{t('location')}</Label>
                <Input
                  id="location"
                  {...form.register('location')}
                  className="mt-1"
                  placeholder="Ciudad, Provincia"
                />
              </div>

              <div>
                <Label htmlFor="m2">{t('surface')}</Label>
                <Input
                  id="m2"
                  type="number"
                  step="0.01"
                  {...form.register('m2')}
                  className="mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="startDate">{t('startDate')}</Label>
                <Input
                  id="startDate"
                  type="date"
                  {...form.register('startDate')}
                  className="mt-1"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">{t('description')}</Label>
                <Textarea
                  id="description"
                  {...form.register('description')}
                  className="mt-1"
                  rows={3}
                  placeholder="Descripción breve del proyecto..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h3 className="font-medium text-foreground">Resumen de Configuración</h3>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Template:</span>{' '}
                {templates.find((t) => t.id === selectedTemplate)?.name}
              </p>
              <p>
                <span className="font-medium">Sistemas constructivos:</span>{' '}
                {selectedSystems.length === 0
                  ? 'Ninguno seleccionado'
                  : selectedSystems.includes('generic')
                    ? 'Genérico (todos los items)'
                    : selectedSystems
                        .map((id) =>
                          constructionSystems.find((s) => s.id === id)?.name
                        )
                        .filter(Boolean)
                        .join(', ')}
              </p>
            </div>
          </div>

          <div className="flex justify-between gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
            >
              Atrás
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear Proyecto'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
