'use client'

import { useForm, Controller } from 'react-hook-form'
import { useTranslations } from 'next-intl'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '@repo/validators'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import { useRouter } from '@/i18n/navigation'
import { updateProject } from '@/app/actions/projects'

type ProjectFormProps = {
  mode: 'create' | 'edit'
  defaultValues?: Partial<UpdateProjectInput>
  projectId?: string
  /** Optional: when not passed, edit mode uses updateProject server action */
  onSubmit?: (
    dataOrProjectId: CreateProjectInput | UpdateProjectInput | string,
    data?: UpdateProjectInput
  ) => Promise<{ error?: Record<string, string[]> } | void>
  onCancelHref: string
}

export function ProjectForm({
  mode,
  defaultValues,
  projectId,
  onSubmit: onSubmitProp,
  onCancelHref,
}: ProjectFormProps) {
  const t = useTranslations('projects')
  const router = useRouter()
  const isCreate = mode === 'create'
  const schema = isCreate ? createProjectSchema : updateProjectSchema
  const {
    register,
    control,
    getValues,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput | UpdateProjectInput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: '',
      clientName: '',
      description: '',
      location: '',
      m2: undefined,
      startDate: undefined,
      plannedEndDate: undefined,
    },
  })

  async function handleFormSubmit(data: CreateProjectInput | UpdateProjectInput) {
    const submit =
      onSubmitProp ??
      (projectId != null
        ? (id: string, d: UpdateProjectInput) => updateProject(id, d)
        : null)

    if (!submit) {
      setError('root', { message: 'Missing submit handler' })
      return
    }

    // En modo edición: phase y status desde getValues() para no depender de data (evitar que serialización los omita)
    const payload: UpdateProjectInput =
      projectId != null
        ? {
            ...data,
            ...(defaultValues && 'phase' in defaultValues
              ? {
                  phase:
                    (getValues('phase') as UpdateProjectInput['phase']) ??
                    (defaultValues as UpdateProjectInput).phase ??
                    'PRE_CONSTRUCTION',
                }
              : {}),
            ...(defaultValues && 'status' in defaultValues
              ? {
                  status:
                    (getValues('status') as UpdateProjectInput['status']) ??
                    (defaultValues as UpdateProjectInput).status,
                }
              : {}),
          }
        : (data as UpdateProjectInput)

    const result =
      projectId != null
        ? await submit(projectId, payload)
        : await submit(data)
    if (result?.error) {
      if (result.error._form) {
        setError('root', { message: result.error._form[0] })
      }
      Object.entries(result.error).forEach(([field, messages]) => {
        if (field !== '_form' && messages?.[0]) {
          setError(field as keyof CreateProjectInput, { message: messages[0] })
        }
      })
      return
    }
    // Navegar al resumen: refrescar caché y luego ir para que el resumen muestre datos actualizados (phase, estado)
    if (projectId != null && result && 'success' in result && result.success) {
      router.refresh()
      router.push(`/projects/${projectId}`)
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del proyecto *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="ej. Torre Oficinas A"
            className="mt-1"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientName">Cliente</Label>
          <Input
            id="clientName"
            {...register('clientName')}
            placeholder="Nombre del cliente o empresa"
            className="mt-1"
          />
          {errors.clientName && (
            <p className="mt-1 text-sm text-destructive">
              {errors.clientName.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Ubicación</Label>
          <Input
            id="location"
            {...register('location')}
            placeholder="Dirección o ubicación del proyecto"
            className="mt-1"
          />
          {errors.location && (
            <p className="mt-1 text-sm text-destructive">
              {errors.location.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="m2">Superficie (m²)</Label>
          <Input
            id="m2"
            type="number"
            step="0.01"
            min="0"
            {...register('m2')}
            placeholder="0"
            className="mt-1"
          />
          {errors.m2 && (
            <p className="mt-1 text-sm text-destructive">
              {errors.m2.message}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="startDate">{t('startDate')}</Label>
          <Input
            id="startDate"
            type="date"
            {...register('startDate')}
            className="mt-1"
          />
          {errors.startDate && (
            <p className="mt-1 text-sm text-destructive">
              {errors.startDate.message}
            </p>
          )}
        </div>
        {!isCreate && (
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <Label htmlFor="plannedEndDate">{t('plannedEndDate')}</Label>
            <Input
              id="plannedEndDate"
              type="date"
              {...register('plannedEndDate')}
              className="mt-1"
            />
            {errors.plannedEndDate && (
              <p className="mt-1 text-sm text-destructive">
                {errors.plannedEndDate.message}
              </p>
            )}
          </div>
        )}
      </div>
      {!isCreate && defaultValues && 'status' in defaultValues && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phase">Fase del proyecto</Label>
            <Controller
              name="phase"
              control={control}
              render={({ field }) => (
                <select
                  id="phase"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="PRE_CONSTRUCTION">Pre-construcción</option>
                  <option value="CONSTRUCTION">En construcción</option>
                  <option value="CLOSEOUT">Cierre</option>
                  <option value="COMPLETE">Completado</option>
                </select>
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <select
                  id="status"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="ON_HOLD">En pausa</option>
                  <option value="COMPLETE">Completado</option>
                </select>
              )}
            />
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea
          id="description"
          {...register('description')}
          rows={3}
          placeholder="Breve descripción del proyecto"
          className="mt-1"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>
      {errors.root && (
        <p className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isCreate
              ? 'Creando…'
              : 'Guardando…'
            : isCreate
              ? 'Crear proyecto'
              : 'Guardar cambios'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={onCancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
