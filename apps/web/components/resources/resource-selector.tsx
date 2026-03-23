'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormContext } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { searchResources } from '@/app/actions/resources'
import { cn } from '@/lib/utils'

export type ResourceOption = {
  id: string
  code: string
  name: string
  category: string
  unit: string
  unitCost: number
}

type ResourceSelectorProps = {
  name?: string
  unitCostName?: string
  unitName?: string
  descriptionName?: string
  onSelect?: (resource: ResourceOption | null) => void
  placeholder?: string
  disabled?: boolean
}

const DEBOUNCE_MS = 300

export function ResourceSelector({
  name = 'resourceId',
  unitCostName = 'unitCost',
  unitName = 'unit',
  descriptionName = 'description',
  onSelect,
  placeholder = 'Search by code or name...',
  disabled,
}: ResourceSelectorProps) {
  const { setValue, watch } = useFormContext()
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ResourceOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [_selected, setSelected] = useState<ResourceOption | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!query.trim()) {
      setOptions([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await searchResources(query, 15)
      setOptions(results as ResourceOption[])
      setLoading(false)
      setOpen(true)
      debounceRef.current = null
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChoose(resource: ResourceOption) {
    setSelected(resource)
    setValue(name, resource.id)
    setValue(unitCostName, resource.unitCost)
    setValue(unitName, resource.unit)
    setValue(descriptionName, resource.name)
    setQuery(`${resource.code} ${resource.name}`)
    setOpen(false)
    setOptions([])
    onSelect?.(resource)
  }

  function handleClear() {
    setSelected(null)
    setValue(name, '')
    setQuery('')
    setOptions([])
    onSelect?.(null)
  }

  const resourceId = watch(name)

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor="resource-search">Resource (optional)</Label>
      <div className="relative mt-1">
        <Input
          id="resource-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => options.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        {resourceId && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={handleClear}
            title="Clear resource"
          >
            ×
          </button>
        )}
      </div>
      {open && (options.length > 0 || loading) && (
        <ul
          className={cn(
            'absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900',
            loading && 'opacity-70'
          )}
        >
          {loading && options.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500">Searching...</li>
          ) : (
            options.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleChoose(r)}
                >
                  <span className="font-mono text-gray-600 dark:text-gray-400">{r.code}</span>
                  {' — '}
                  <span className="text-gray-900 dark:text-white">{r.name}</span>
                  <span className="ml-2 text-gray-500">
                    {r.unit} @ {new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(r.unitCost)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
