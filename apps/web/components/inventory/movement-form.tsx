'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInventoryMovement } from '@/app/actions/inventory'
import { generateMovementIdempotencyKey } from '@/lib/inventory-idempotency'

type Item = { id: string; sku: string; name: string }
type Location = { id: string; name: string; type: string; projectId: string | null }
type Project = { id: string; name: string }
type WbsNode = { id: string; code: string; name: string; projectId: string }

type MovementFormProps = {
  items: Item[]
  locations: Location[]
  projects?: Project[]
  wbsNodes?: WbsNode[]
  defaultItemId?: string
}

export function MovementForm({
  items,
  locations,
  projects = [],
  wbsNodes = [],
  defaultItemId,
}: MovementFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [movementType, setMovementType] = useState<string>('PURCHASE')
  const [projectId, setProjectId] = useState<string>('')
  const [projectWbsNodes, setProjectWbsNodes] = useState<WbsNode[]>([])

  const warehouses = locations.filter(
    (l) => l.type === 'CENTRAL_WAREHOUSE' || l.type === 'PROJECT_SITE'
  )
  const projectSites = locations.filter((l) => l.type === 'PROJECT_SITE')
  useEffect(() => {
    if (projectId) {
      setProjectWbsNodes(wbsNodes.filter((w) => w.projectId === projectId))
    } else {
      setProjectWbsNodes([])
    }
  }, [projectId, wbsNodes])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const form = e.currentTarget
    const fd = new FormData(form)
    const itemId = fd.get('itemId') as string
    const qty = parseFloat(fd.get('quantity') as string)
    const unitCost = parseFloat(fd.get('unitCost') as string)
    const idempotencyKey = generateMovementIdempotencyKey(
      itemId,
      movementType,
      qty
    )

    try {
      await createInventoryMovement({
        itemId,
        movementType: movementType as 'PURCHASE' | 'TRANSFER' | 'ISSUE' | 'ADJUSTMENT',
        fromLocationId: (fd.get('fromLocationId') as string) || undefined,
        toLocationId: (fd.get('toLocationId') as string) || undefined,
        projectId: (fd.get('projectId') as string) || undefined,
        wbsNodeId: (fd.get('wbsNodeId') as string) || undefined,
        quantity: qty,
        unitCost,
        notes: (fd.get('notes') as string) || undefined,
        idempotencyKey,
      })
      router.push('/inventory/movements')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create movement')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="erp-form-page space-y-4">
      <div>
        <Label htmlFor="movementType">Movement type</Label>
        <select
          id="movementType"
          value={movementType}
          onChange={(e) => setMovementType(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="PURCHASE">PURCHASE (Supplier → Warehouse)</option>
          <option value="TRANSFER">TRANSFER (Warehouse → Site)</option>
          <option value="ISSUE">ISSUE (Site → WBS)</option>
          <option value="ADJUSTMENT">ADJUSTMENT</option>
        </select>
      </div>

      <div>
        <Label htmlFor="itemId">Item</Label>
        <select
          id="itemId"
          name="itemId"
          required
          defaultValue={defaultItemId}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">Select item</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} – {i.name}
            </option>
          ))}
        </select>
      </div>

      {['TRANSFER', 'ISSUE', 'ADJUSTMENT'].includes(movementType) && (
        <div>
          <Label htmlFor="fromLocationId">From location</Label>
          <select
            id="fromLocationId"
            name="fromLocationId"
            required={['TRANSFER', 'ISSUE'].includes(movementType)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Select location</option>
            {warehouses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.type.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
        </div>
      )}

      {['PURCHASE', 'TRANSFER', 'ADJUSTMENT'].includes(movementType) && (
        <div>
          <Label htmlFor="toLocationId">To location</Label>
          <select
            id="toLocationId"
            name="toLocationId"
            required={['PURCHASE', 'TRANSFER'].includes(movementType)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="">Select location</option>
            {movementType === 'PURCHASE' &&
              warehouses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            {movementType === 'TRANSFER' &&
              projectSites.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            {movementType === 'ADJUSTMENT' &&
              warehouses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {movementType === 'ISSUE' && (
        <>
          <div>
            <Label htmlFor="projectId">Project</Label>
            <select
              id="projectId"
              name="projectId"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Select project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="wbsNodeId">WBS node</Label>
            <select
              id="wbsNodeId"
              name="wbsNodeId"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            >
              <option value="">Select WBS node</option>
              {projectWbsNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} – {n.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="quantity">Quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={0.0001}
            step="0.0001"
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="unitCost">Unit cost</Label>
          <div className="mt-1 flex items-center rounded-md border border-input bg-card dark:bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="pl-3 text-muted-foreground">$</span>
            <Input
              id="unitCost"
              name="unitCost"
              type="number"
              min={0}
              step="0.01"
              required
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create movement'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/inventory/movements')}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
