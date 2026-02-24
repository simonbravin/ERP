/**
 * One-off: move "Carpeta de prueba 1" under project root for project "Prueba carga de Datos".
 * Run from packages/database: pnpm exec tsx src/fix-folder-parent.ts
 */
import { prisma } from './client'

const PROJECT_NAME = 'Prueba carga de Datos'
const FOLDER_NAME = 'Carpeta de prueba 1'

async function main() {
  const project = await prisma.project.findFirst({
    where: { name: { contains: 'Prueba carga', mode: 'insensitive' } },
    select: { id: true, name: true, orgId: true },
  })

  if (!project) {
    console.error(`Project not found (searched for name containing "Prueba carga").`)
    process.exit(1)
  }

  console.log(`Project: ${project.name} (id: ${project.id})`)

  // Root folder is created with name = project.name (see projects.ts). Match by trimmed name.
  const projectNameTrimmed = project.name.trim()
  let candidatesRoot = await prisma.documentFolder.findMany({
    where: { projectId: project.id, parentId: null },
    select: { id: true, name: true },
  })
  let rootFolder = candidatesRoot.find((f) => f.name.trim().toLowerCase() === projectNameTrimmed.toLowerCase())

  if (!rootFolder) {
    // Create root folder if missing (e.g. project created before root-folder feature or broken state)
    rootFolder = await prisma.documentFolder.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        parentId: null,
        name: projectNameTrimmed,
      },
      select: { id: true, name: true },
    })
    console.log(`Created missing root folder: ${rootFolder.name} (id: ${rootFolder.id})`)
  } else {
    console.log(`Root folder: ${rootFolder.name} (id: ${rootFolder.id})`)
  }

  // Carpeta de prueba 1: wrong if parentId is not the project root (null, self-ref, or other)
  const orphanFolder = await prisma.documentFolder.findFirst({
    where: {
      projectId: project.id,
      name: { contains: 'Carpeta de prueba 1', mode: 'insensitive' },
      parentId: { not: rootFolder.id },
    },
    select: { id: true, name: true, parentId: true },
  })

  if (!orphanFolder) {
    console.log(`No folder "${FOLDER_NAME}" with wrong parent found. It may already be under the root.`)
    process.exit(0)
  }

  await prisma.documentFolder.update({
    where: { id: orphanFolder.id },
    data: { parentId: rootFolder.id },
  })

  console.log(`Updated "${orphanFolder.name}" (id: ${orphanFolder.id}): parentId ${orphanFolder.parentId ?? 'null'} -> ${rootFolder.id} (${rootFolder.name})`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
