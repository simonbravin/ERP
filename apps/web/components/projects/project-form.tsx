'use client'

import { useForm, Controller } from 'react-hook-form'
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
      className="erp-form-page space-y-6 rounded-lg border border-border bg-card p-6"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre del proyecto *</Label>
          <Input
            id="name"
            {...register('name')}
            placeholder="ej. Torre Oficinas A"
          />
          {errors.name && (
            <p className="text-sm text-destructive">
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
          />
          {errors.clientName && (
            <p className="text-sm text-destructive">
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
          />
          {errors.location && (
            <p className="text-sm text-destructive">
              {errors.location.message}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <textarea
            id="description"
            {...register('description')}
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Brief description"
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="m2">Superficie (m²)</Label>
            <Input
              id="m2"
              type="number"
              step="0.01"
              min="0"
              {...register('m2')}
              placeholder="0"
            />
            {errors.m2 && (
              <p className="text-sm text-destructive">
                {errors.m2.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha de inicio</Label>
            <Input
              id="startDate"
              type="date"
              {...register('startDate')}
            />
            {errors.startDate && (
              <p className="text-sm text-destructive">
                {errors.startDate.message}
              </p>
            )}
          </div>
        </div>
        {!isCreate && defaultValues && 'status' in defaultValues && (
          <>
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
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
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
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="ACTIVE">Activo</option>
                    <option value="ON_HOLD">En pausa</option>
                    <option value="COMPLETE">Completado</option>
                  </select>
                )}
              />
            </div>
          </>
        )}
      </div>
      {errors.root && (
        <p className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? isCreate
              ? 'Creando…'
              : 'Guardando…'
            : isCreate
              ? 'Crear proyecto'
              : 'Guardar cambios'}
        </Button>
        <Link
          href={onCancelHref}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-transparent px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  )
}
