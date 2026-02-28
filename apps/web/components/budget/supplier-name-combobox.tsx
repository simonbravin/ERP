'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ChevronDown, X, PlusCircle } from 'lucide-react'

interface Supplier {
  id: string
  name: string
}

interface SupplierNameComboboxProps {
  /** Current supplier name (free text or from a selected supplier). */
  value: string
  onChange: (name: string) => void
  /** List of registered suppliers to filter from. */
  suppliers: Supplier[]
  /** Create a new supplier with the given name; returns the saved name. */
  onCreateSupplier?: (name: string) => Promise<{ name: string } | { error: string }>
  placeholder?: string
  disabled?: boolean
  /** Compact style for use inside table cells. */
  compact?: boolean
  className?: string
}

export function SupplierNameCombobox({
  value,
  onChange,
  suppliers,
  onCreateSupplier,
  placeholder = 'Proveedor',
  disabled,
  compact,
  className,
}: SupplierNameComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const searchTrim = search.trim().toLowerCase()
  const filtered =
    searchTrim.length > 0
      ? suppliers.filter((s) => s.name.toLowerCase().includes(searchTrim))
      : suppliers
  const exactMatch =
    searchTrim.length > 0 &&
    suppliers.some((s) => s.name.toLowerCase() === searchTrim)
  const showCreateOption =
    !!onCreateSupplier &&
    searchTrim.length >= 2 &&
    !exactMatch

  useEffect(() => {
    if (!open) {
      const trimmed = search.trim()
      if (trimmed) onChange(trimmed)
      setSearch('')
    }
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayValue = open ? search : value

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <div className="flex rounded-md border border-input bg-card ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <Input
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none',
            compact && 'h-8 text-sm'
          )}
        />
        <div className="flex items-center border-l">
          {value && !open ? (
            <button
              type="button"
              onClick={() => onChange('')}
              className="p-2 hover:bg-muted rounded-r-md"
              aria-label="Limpiar"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="p-2 hover:bg-muted rounded-r-md"
              aria-label="Abrir lista"
            >
              <ChevronDown className={cn('h-4 w-4 text-muted-foreground', open && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>
      {open && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full min-w-[200px] overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
          role="listbox"
        >
          <li
            role="option"
            className="relative cursor-pointer select-none px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"
            onMouseDown={(e) => {
              e.preventDefault()
              setSearch('')
              onChange('')
              setOpen(false)
            }}
          >
            — Ninguno
          </li>
          {showCreateOption && (
            <li
              role="option"
              className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted text-primary border-t"
              onMouseDown={async (e) => {
                e.preventDefault()
                if (isCreating || !onCreateSupplier) return
                setIsCreating(true)
                try {
                  const result = await onCreateSupplier(searchTrim)
                  if ('name' in result) {
                    setSearch('')
                    onChange(result.name)
                    setOpen(false)
                  }
                } finally {
                  setIsCreating(false)
                }
              }}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              {isCreating ? 'Creando…' : `Agregar "${searchTrim}" como proveedor`}
            </li>
          )}
          {filtered.length === 0 && !showCreateOption ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
          ) : (
            filtered.map((s) => (
              <li
                key={s.id}
                role="option"
                className={cn(
                  'relative cursor-pointer select-none px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted',
                  value === s.name && 'bg-muted'
                )}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setSearch('')
                  onChange(s.name)
                  setOpen(false)
                }}
              >
                {s.name}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
