'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { List, Grid, FileText } from 'lucide-react'
import { DocumentList, type DocumentRow } from './document-list'
import { DocumentCard } from './document-card'

type DocumentsPageClientProps = {
  documents: DocumentRow[]
}

export function DocumentsPageClient({ documents }: DocumentsPageClientProps) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')

  const filtered = useMemo(() => {
    if (!search.trim()) return documents
    const q = search.trim().toLowerCase()
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(q) ||
        (doc.description?.toLowerCase().includes(q) ?? false) ||
        (doc.category?.toLowerCase().includes(q) ?? false) ||
        (doc.project?.name.toLowerCase().includes(q) ?? false)
    )
  }, [documents, search])

  return (
    <div className="w-full space-y-4">
      <div className="erp-search-row">
        <div className="erp-search-input-wrap">
          <Input
            type="search"
            placeholder="Buscar por título, descripción, categoría o proyecto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="erp-search-input"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Vista:</span>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="h-8 px-3"
            title="Vista de tabla"
          >
            <List className="mr-1.5 h-4 w-4" />
            Tabla
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 px-3"
            title="Vista de cuadrícula"
          >
            <Grid className="mr-1.5 h-4 w-4" />
            Cuadrícula
          </Button>
        </div>
      </div>

      {viewMode === 'table' ? (
        <DocumentList documents={filtered} />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} document={doc} />
          ))}
        </div>
      ) : (
        <div className="erp-card flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            No hay documentos. Sube uno para comenzar.
          </p>
        </div>
      )}
    </div>
  )
}
