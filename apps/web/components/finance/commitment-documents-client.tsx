'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  listDocumentsForEntity,
  linkDocumentToEntity,
  createDocument,
  getDocumentDownloadUrl,
} from '@/app/actions/documents'
import { COMMITMENT_ENTITY } from '@/lib/document-entities'
import { FileAndCameraTrigger } from '@/components/ui/file-and-camera-trigger'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Props {
  commitmentId: string
  projectId: string
}

export function CommitmentDocumentsClient({ commitmentId, projectId }: Props) {
  const t = useTranslations('common')
  const tFin = useTranslations('finance')
  const [docs, setDocs] = useState<{ id: string; documentId: string; title: string; docType: string; versionId: string; fileName: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    listDocumentsForEntity(COMMITMENT_ENTITY, commitmentId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [commitmentId])

  async function handleFileSelect(file: File) {
    if (!commitmentId || !projectId) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set('projectId', projectId)
      formData.set('title', (file.name || '').replace(/\.[^.]+$/, '').trim() || file.name || 'Adjunto')
      formData.set('docType', 'OTHER')
      formData.set('file', file)
      const result = await createDocument(formData)
      if (result && 'docId' in result) {
        await linkDocumentToEntity(result.docId, COMMITMENT_ENTITY, commitmentId)
        const list = await listDocumentsForEntity(COMMITMENT_ENTITY, commitmentId)
        setDocs(list)
        toast.success(tFin('toast.documentAttached'))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tFin('toast.attachUploadError'))
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(versionId: string) {
    try {
      const { url } = await getDocumentDownloadUrl(versionId)
      window.open(url, '_blank')
    } catch {
      toast.error(tFin('downloadAttachmentError'))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
        <CardTitle className="text-base">{tFin('commitmentDocumentsSectionTitle')}</CardTitle>
        <FileAndCameraTrigger
          onFileSelect={handleFileSelect}
          disabled={!commitmentId || !projectId}
          loading={uploading}
          t={t}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando...
          </div>
        ) : docs.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Sin documentos adjuntos. Podés subir cotizaciones o presupuestos para comparar.
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                <span className="min-w-0 truncate text-sm">{d.title || d.fileName}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => handleDownload(d.versionId)}
                >
                  <FileDown className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
