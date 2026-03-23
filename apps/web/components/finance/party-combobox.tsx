'use client'

import { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { ChevronDown, X, PlusCircle } from 'lucide-react'

interface Party { id: string; name: string }

interface PartyComboboxProps {
  label: string
  placeholder: string
  parties: Party[]
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  id?: string
  /** Allow creating a new party when the typed name is not in the list */
  allowCreate?: boolean
  partyType?: 'CLIENT' | 'SUPPLIER'
  onCreateParty?: (name: string) => Promise<{ id: string; name: string } | { error: string }>
}

export function PartyCombobox({
  label,
  placeholder,
  parties,
  value,
  onChange,
  disabled,
  id = 'partyId',
  allowCreate,
  partyType,
  onCreateParty,
}: PartyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = parties.find((p) => p.id === value)
  const searchTrim = search.trim()
  const filtered = searchTrim
    ? parties.filter((p) =>
        p.name.toLowerCase().includes(searchTrim.toLowerCase())
      )
    : parties
  const exactMatch =
    searchTrim &&
    parties.some((p) => p.name.toLowerCase() === searchTrim.toLowerCase())
  const showCreateOption =
    !!allowCreate &&
    !!partyType &&
    !!onCreateParty &&
    searchTrim.length >= 2 &&
    !exactMatch

  useEffect(() => {
    if (!open) setSearch('')
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

  return (
    <div className="space-y-2" ref={containerRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <div className="flex rounded-md border border-input bg-card dark:bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <Input
            id={id}
            value={open ? search : (selected?.name ?? '')}
            onChange={(e) => {
              setSearch(e.target.value)
              if (!open) setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder={selected ? selected.name : placeholder}
            disabled={disabled}
            className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 rounded-r-none"
          />
          <div className="flex items-center border-l">
            {value ? (
              <button
                type="button"
                onClick={() => onChange(null)}
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
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
            role="listbox"
          >
            <li
              role="option"
              aria-selected={value === null}
              className="relative cursor-pointer select-none px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted"
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(null)
                setOpen(false)
              }}
            >
              — Ninguno
            </li>
            {showCreateOption && (
              <li
                role="option"
                aria-selected={false}
                className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted text-primary border-t"
                onMouseDown={async (e) => {
                  e.preventDefault()
                  if (isCreating || !onCreateParty) return
                  setIsCreating(true)
                  try {
                    const result = await onCreateParty(searchTrim)
                    if ('id' in result) {
                      onChange(result.id)
                      setSearch('')
                      setOpen(false)
                    }
                  } finally {
                    setIsCreating(false)
                  }
                }}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                {isCreating
                  ? 'Creando…'
                  : partyType === 'CLIENT'
                    ? `Crear "${searchTrim}" como nuevo cliente`
                    : `Crear "${searchTrim}" como nuevo proveedor`}
              </li>
            )}
            {filtered.length === 0 && !showCreateOption ? (
              <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
                Sin resultados
              </li>
            ) : (
              filtered.map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={value === p.id}
                  className={cn(
                    'relative cursor-pointer select-none px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted',
                    value === p.id && 'bg-muted'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onChange(p.id)
                    setOpen(false)
                  }}
                >
                  {p.name}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
