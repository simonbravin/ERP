'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@repo/database'
import { requireRole } from '@/lib/rbac'
import { getAuthContext } from '@/lib/auth-helpers'
import { assertProjectAccess, canEditProjectArea, PROJECT_AREAS } from '@/lib/project-permissions'
import { getVisibleProjectIds } from '@/lib/org-context'
import { uploadToR2, getDownloadUrl, calculateChecksum } from '@/lib/r2-client'
import { publishOutboxEvent } from '@/lib/events/event-publisher'

/** Use this so we throw a clear error if Prisma client was not regenerated after adding DocumentFolder. */
function getDocumentFolderModel() {
  const model = (prisma as { documentFolder?: unknown }).documentFolder
  if (!model || typeof (model as { findFirst: unknown }).findFirst !== 'function') {
    throw new Error(
      'Prisma client desactualizado: ejecutá "pnpm exec prisma generate" desde packages/database (con el servidor detenido) y reiniciá.'
    )
  }
  return model as typeof prisma.documentFolder
}

const PROJECT_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024 // 500 MB
const UNLIMITED_STORAGE_GB = 0 // convention: maxStorageGB === 0 means unlimited

async function getOrgDocumentStorageUsed(orgId: string): Promise<number> {
  const r = await prisma.documentVersion.aggregate({
    where: { document: { orgId, deleted: false } },
    _sum: { sizeBytes: true },
  })
  return r._sum.sizeBytes ?? 0
}

async function getProjectDocumentStorageUsed(projectId: string): Promise<number> {
  const r = await prisma.documentVersion.aggregate({
    where: { document: { projectId, deleted: false } },
    _sum: { sizeBytes: true },
  })
  return r._sum.sizeBytes ?? 0
}

export async function createDocument(formData: FormData) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const titleRaw = (formData.get('title') as string)?.trim() ?? ''
  const docType = formData.get('docType') as string
  const category = (formData.get('category') as string) || undefined
  const description = (formData.get('description') as string) || undefined
  const projectIdRaw = formData.get('projectId') as string | null
  const projectId = projectIdRaw && projectIdRaw.trim() ? projectIdRaw : undefined
  const folderIdRaw = formData.get('folderId') as string | null
  const folderId = folderIdRaw && folderIdRaw.trim() ? folderIdRaw : undefined
  const file = formData.get('file') as File

  if (projectId) {
    try {
      const access = await assertProjectAccess(projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DOCUMENTS)) {
        throw new Error('No tenés permiso para editar documentos de este proyecto')
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('permiso')) throw e
      throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
    }
  }

  if (!docType || !file) {
    throw new Error('Faltan campos obligatorios: tipo de documento y archivo.')
  }

  const fromFile = file.name
    ? (file.name.replace(/\.[^.]+$/, '').trim() || file.name)
    : ''
  const title = titleRaw || fromFile || 'Documento'

  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('El archivo es demasiado grande (máximo 50 MB)')
  }

  if (projectId) {
    const projectUsed = await getProjectDocumentStorageUsed(projectId)
    if (projectUsed + file.size > PROJECT_STORAGE_LIMIT_BYTES) {
      throw new Error(
        `Se superó el límite de almacenamiento del proyecto (500 MB). En uso: ${(projectUsed / (1024 * 1024)).toFixed(1)} MB.`
      )
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: org.orgId },
    select: { maxStorageGB: true },
  })
  const maxStorageGB = organization?.maxStorageGB ?? 1
  if (maxStorageGB !== UNLIMITED_STORAGE_GB && maxStorageGB > 0) {
    const orgUsed = await getOrgDocumentStorageUsed(org.orgId)
    const limitBytes = maxStorageGB * 1024 * 1024 * 1024
    if (orgUsed + file.size > limitBytes) {
      throw new Error(
        `Se superó el límite de almacenamiento de la organización (${maxStorageGB} GB). En uso: ${(orgUsed / (1024 * 1024 * 1024)).toFixed(2)} GB.`
      )
    }
  }

  const checksum = await calculateChecksum(file)

  const doc = await prisma.$transaction(async (tx) => {
    const created = await tx.document.create({
      data: {
        orgId: org.orgId,
        projectId,
        folderId,
        title,
        docType,
        category,
        description,
        isPublic: false,
        createdByOrgMemberId: org.memberId,
      },
    })

    const storageKey = `${org.orgId}/${created.id}/1/${file.name}`
    await uploadToR2(file, storageKey)

    await tx.documentVersion.create({
      data: {
        orgId: org.orgId,
        documentId: created.id,
        versionNumber: 1,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey,
        checksum,
        uploadedByOrgMemberId: org.memberId,
      },
    })

    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'DOCUMENT.UPLOADED',
      entityType: 'Document',
      entityId: created.id,
      payload: { projectId: projectId ?? undefined, title: created.title },
    })
    return created
  })

  revalidatePath('/documents')
  if (projectId) {
    revalidatePath(`/projects/${projectId}/documents`)
  }

  return { success: true, docId: doc.id }
}

export async function uploadNewVersion(docId: string, formData: FormData) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const file = formData.get('file') as File
  const notes = (formData.get('notes') as string) || undefined

  if (!file) throw new Error('No file provided')

  const doc = await prisma.document.findFirst({
    where: { id: docId, orgId: org.orgId },
    include: {
      versions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  })

  if (!doc) throw new Error('Document not found')
  if (doc.deleted) throw new Error('Cannot add version to deleted document')
  if (doc.projectId) {
    try {
      const access = await assertProjectAccess(doc.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DOCUMENTS)) {
        throw new Error('No tenés permiso para editar documentos de este proyecto')
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('permiso')) throw e
      throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
    }
    const projectUsed = await getProjectDocumentStorageUsed(doc.projectId)
    if (projectUsed + file.size > PROJECT_STORAGE_LIMIT_BYTES) {
      throw new Error(
        `Se superó el límite de almacenamiento del proyecto (500 MB). En uso: ${(projectUsed / (1024 * 1024)).toFixed(1)} MB.`
      )
    }
  }

  const organization = await prisma.organization.findUnique({
    where: { id: org.orgId },
    select: { maxStorageGB: true },
  })
  const maxStorageGB = organization?.maxStorageGB ?? 1
  if (maxStorageGB !== UNLIMITED_STORAGE_GB && maxStorageGB > 0) {
    const orgUsed = await getOrgDocumentStorageUsed(org.orgId)
    const limitBytes = maxStorageGB * 1024 * 1024 * 1024
    if (orgUsed + file.size > limitBytes) {
      throw new Error(
        `Se superó el límite de almacenamiento de la organización (${maxStorageGB} GB). En uso: ${(orgUsed / (1024 * 1024 * 1024)).toFixed(2)} GB.`
      )
    }
  }

  const maxSize = 50 * 1024 * 1024
  if (file.size > maxSize) {
    throw new Error('El archivo es demasiado grande (máximo 50 MB)')
  }

  const nextVersion = (doc.versions[0]?.versionNumber ?? 0) + 1
  const checksum = await calculateChecksum(file)
  const storageKey = `${org.orgId}/${doc.id}/${nextVersion}/${file.name}`

  await uploadToR2(file, storageKey)

  await prisma.$transaction(async (tx) => {
    const version = await tx.documentVersion.create({
      data: {
        orgId: org.orgId,
        documentId: docId,
        versionNumber: nextVersion,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey,
        checksum,
        notes,
        uploadedByOrgMemberId: org.memberId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'DOCUMENT.VERSION_ADDED',
      entityType: 'DocumentVersion',
      entityId: version.id,
      payload: { documentId: docId, versionNumber: nextVersion, projectId: doc.projectId ?? undefined },
    })
  })

  revalidatePath('/documents')
  revalidatePath(`/documents/${docId}`)
  if (doc.projectId) {
    revalidatePath(`/projects/${doc.projectId}/documents`)
  }
  return { success: true }
}

export async function getDocumentDownloadUrl(versionId: string) {
  const { org } = await getAuthContext()

  const version = await prisma.documentVersion.findFirst({
    where: { id: versionId, orgId: org.orgId },
    select: { storageKey: true, document: { select: { projectId: true } } },
  })

  if (!version) throw new Error('Version not found')
  if (version.document.projectId) {
    try {
      await assertProjectAccess(version.document.projectId, org)
    } catch {
      throw new Error('Acceso denegado')
    }
  }

  const url = await getDownloadUrl(version.storageKey)
  return { url }
}

export async function linkDocumentToEntity(
  docId: string,
  entityType: string,
  entityId: string
) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const doc = await prisma.document.findFirst({
    where: { id: docId, orgId: org.orgId },
  })
  if (!doc) throw new Error('Document not found')
  if (doc.deleted) throw new Error('Cannot link deleted document')
  if (doc.projectId) {
    try {
      const access = await assertProjectAccess(doc.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DOCUMENTS)) {
        throw new Error('No tenés permiso para editar documentos de este proyecto')
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('permiso')) throw e
      throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
    }
  }

  const existing = await prisma.documentLink.findFirst({
    where: {
      documentId: docId,
      entityType,
      entityId,
    },
  })

  if (existing) return { success: true, linkId: existing.id }

  const link = await prisma.$transaction(async (tx) => {
    const created = await tx.documentLink.create({
      data: {
        orgId: org.orgId,
        documentId: docId,
        entityType,
        entityId,
      },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'DOCUMENT.LINKED',
      entityType: 'DocumentLink',
      entityId: created.id,
      payload: { documentId: docId, entityType, entityId },
    })
    return created
  })

  revalidatePath(`/documents/${docId}`)
  return { success: true, linkId: link.id }
}

/** List documents linked to an entity (e.g. a transaction). */
export async function listDocumentsForEntity(
  entityType: string,
  entityId: string
): Promise<{ id: string; documentId: string; title: string; docType: string; versionId: string; fileName: string }[]> {
  const { org } = await getAuthContext()

  const links = await prisma.documentLink.findMany({
    where: { orgId: org.orgId, entityType, entityId },
    include: {
      document: {
        select: {
          id: true,
          title: true,
          docType: true,
          deleted: true,
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { id: true, fileName: true },
          },
        },
      },
    },
  })

  return links
    .filter((l) => !l.document.deleted && l.document.versions[0])
    .map((l) => ({
      id: l.id,
      documentId: l.document.id,
      title: l.document.title,
      docType: l.document.docType,
      versionId: l.document.versions[0].id,
      fileName: l.document.versions[0].fileName,
    }))
}

export async function deleteDocument(docId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const doc = await prisma.document.findFirst({
    where: { id: docId, orgId: org.orgId },
  })
  if (!doc) throw new Error('Document not found')
  if (doc.projectId) {
    try {
      const access = await assertProjectAccess(doc.projectId, org)
      if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DOCUMENTS)) {
        throw new Error('No tenés permiso para editar documentos de este proyecto')
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('permiso')) throw e
      throw new Error(e instanceof Error ? e.message : 'Acceso denegado')
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.document.update({
      where: { id: docId },
      data: { deleted: true },
    })
    await publishOutboxEvent(tx, {
      orgId: org.orgId,
      eventType: 'DOCUMENT.DELETED',
      entityType: 'Document',
      entityId: docId,
      payload: { projectId: doc.projectId ?? undefined },
    })
  })

  revalidatePath('/documents')
  if (doc.projectId) {
    revalidatePath(`/projects/${doc.projectId}/documents`)
  }
  revalidatePath(`/documents/${docId}`)
  return { success: true }
}

export async function createDocumentFolder(params: {
  projectId?: string | null
  parentId?: string | null
  name: string
}) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'EDITOR')

  const { projectId, name } = params
  let { parentId } = params
  if (!name?.trim()) throw new Error('El nombre de la carpeta es obligatorio')

  if (projectId) {
    const access = await assertProjectAccess(projectId, org)
    if (!canEditProjectArea(access.projectRole, PROJECT_AREAS.DOCUMENTS)) {
      throw new Error('No tenés permiso para editar documentos de este proyecto')
    }
    // Si estamos en proyecto y no se pasó carpeta padre, crear dentro de la raíz del proyecto
    if (!parentId) {
      const root = await getDocumentFolderModel().findFirst({
        where: { projectId, parentId: null, orgId: org.orgId },
        select: { id: true },
      })
      if (root) parentId = root.id
    }
  }

  if (parentId) {
    const parent = await getDocumentFolderModel().findFirst({
      where: { id: parentId, orgId: org.orgId },
    })
    if (!parent) throw new Error('Carpeta padre no encontrada')
    if (projectId && parent.projectId !== projectId) throw new Error('La carpeta padre no pertenece al proyecto')
  }

  const docFolder = getDocumentFolderModel()
  const folder = await docFolder.create({
    data: {
      orgId: org.orgId,
      projectId: projectId ?? null,
      parentId: parentId ?? null,
      name: name.trim(),
    },
  })

  revalidatePath('/documents')
  if (projectId) revalidatePath(`/projects/${projectId}/documents`)
  return { success: true, folderId: folder.id }
}

export async function deleteDocumentFolder(folderId: string) {
  const { org } = await getAuthContext()
  requireRole(org.role, 'ADMIN')

  const docFolder = getDocumentFolderModel()
  const folder = await docFolder.findFirst({
    where: { id: folderId, orgId: org.orgId },
    select: { id: true, projectId: true, parentId: true },
  })
  if (!folder) throw new Error('Carpeta no encontrada')

  const [childCount, docCount] = await Promise.all([
    docFolder.count({ where: { parentId: folderId } }),
    prisma.document.count({
      where: { folderId, orgId: org.orgId, deleted: false },
    }),
  ])
  if (childCount > 0 || docCount > 0) {
    throw new Error(
      'No se puede eliminar la carpeta: tiene subcarpetas o documentos. Vaciala primero.'
    )
  }

  await docFolder.delete({ where: { id: folderId } })
  revalidatePath('/documents')
  if (folder.projectId) revalidatePath(`/projects/${folder.projectId}/documents`)
  return { success: true }
}

export async function listOrgRootFolders() {
  const { org } = await getAuthContext()
  const folders = await getDocumentFolderModel().findMany({
    where: { orgId: org.orgId, projectId: null, parentId: null },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return folders
}

export async function getProjectRootFolder(projectId: string) {
  const { org } = await getAuthContext()
  await assertProjectAccess(projectId, org)
  const folder = await getDocumentFolderModel().findFirst({
    where: { projectId, parentId: null, orgId: org.orgId },
    select: { id: true, name: true },
  })
  return folder
}

export async function listFolderContents(folderId: string | null, projectId: string | null) {
  const { org } = await getAuthContext()
  let effectiveFolderId = folderId

  if (projectId) {
    await assertProjectAccess(projectId, org)
    if (!folderId) {
      const root = await getDocumentFolderModel().findFirst({
        where: { projectId, parentId: null, orgId: org.orgId },
        select: { id: true },
      })
      effectiveFolderId = root?.id ?? null
    }
  } else if (folderId) {
    const folder = await getDocumentFolderModel().findFirst({
      where: { id: folderId, orgId: org.orgId, projectId: null },
    })
    if (!folder) throw new Error('Carpeta no encontrada')
  }

  const folderScope = projectId ? { projectId } : { projectId: null as string | null }
  const docFolder = getDocumentFolderModel()
  const [currentFolder, subfolders, documents] = await Promise.all([
    effectiveFolderId
      ? docFolder.findFirst({
          where: { id: effectiveFolderId, orgId: org.orgId },
          select: { id: true, name: true, parentId: true },
        })
      : Promise.resolve(null),
    docFolder.findMany({
      where: { parentId: effectiveFolderId, orgId: org.orgId, ...folderScope },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.document.findMany({
      where: {
        orgId: org.orgId,
        deleted: false,
        ...(projectId ? { projectId } : { projectId: null }),
        ...(projectId && effectiveFolderId
          ? { OR: [{ folderId: effectiveFolderId }, { folderId: null }] }
          : { folderId: effectiveFolderId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { user: { select: { fullName: true } } } },
        project: { select: { id: true, name: true, projectNumber: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          select: { versionNumber: true, fileName: true, sizeBytes: true },
        },
      },
    }),
  ])

  // Build full folder path from current up to root (for breadcrumb)
  const folderPath: { id: string; name: string }[] = []
  if (currentFolder) {
    let cursor: { id: string; name: string; parentId: string | null } | null = currentFolder
    while (cursor) {
      folderPath.unshift({ id: cursor.id, name: cursor.name })
      if (!cursor.parentId) break
      const parent = await docFolder.findFirst({
        where: { id: cursor.parentId, orgId: org.orgId },
        select: { id: true, name: true, parentId: true },
      })
      cursor = parent
    }
  }

  return { folderId: effectiveFolderId, currentFolder, folderPath, subfolders, documents }
}

export async function getOrgStorageUsage() {
  const { org } = await getAuthContext()
  const usedBytes = await getOrgDocumentStorageUsed(org.orgId)
  const organization = await prisma.organization.findUnique({
    where: { id: org.orgId },
    select: { maxStorageGB: true },
  })
  const maxStorageGB = organization?.maxStorageGB ?? 1
  const limitBytes =
    maxStorageGB === UNLIMITED_STORAGE_GB || maxStorageGB <= 0
      ? null
      : maxStorageGB * 1024 * 1024 * 1024
  return { usedBytes, limitBytes }
}

export async function getProjectStorageUsage(projectId: string) {
  const { org } = await getAuthContext()
  await assertProjectAccess(projectId, org)
  const usedBytes = await getProjectDocumentStorageUsed(projectId)
  return { usedBytes, limitBytes: PROJECT_STORAGE_LIMIT_BYTES }
}
