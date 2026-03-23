import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs/promises'
import path from 'path'

/** Thrown when the app runs on a read-only host (e.g. Vercel) without R2 configured. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Las subidas de archivos requieren Cloudflare R2 en este entorno. Configurá R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET_NAME.',
    )
    this.name = 'StorageNotConfiguredError'
  }
}

const isR2Configured =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET_NAME

export const r2Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null

/** When R2 is not configured, writes file to public/uploads/{key} so it can be served at /uploads/{key} */
async function uploadToLocal(file: File, key: string): Promise<void> {
  if (process.env.VERCEL === '1') {
    throw new StorageNotConfiguredError()
  }
  const dir = path.join(process.cwd(), 'public', 'uploads', path.dirname(key))
  await fs.mkdir(dir, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  const filePath = path.join(process.cwd(), 'public', 'uploads', key)
  await fs.writeFile(filePath, buffer)
}

export async function uploadToR2(
  file: File,
  key: string,
  contentType?: string,
): Promise<void> {
  const resolvedType = contentType?.trim() || file.type || 'application/octet-stream'
  if (r2Client && process.env.R2_BUCKET_NAME) {
    const buffer = await file.arrayBuffer()
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: Buffer.from(buffer),
        ContentType: resolvedType,
      })
    )
    return
  }
  await uploadToLocal(file, key)
}

export async function getDownloadUrl(storageKey: string): Promise<string> {
  if (r2Client && process.env.R2_BUCKET_NAME) {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
    })
    return await getSignedUrl(r2Client, command, { expiresIn: 3600 })
  }
  return `/uploads/${storageKey}`
}

export async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
