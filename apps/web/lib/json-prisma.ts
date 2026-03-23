import type { Prisma } from '@repo/database'

/** Serialize plain objects for Prisma Json / InputJsonValue fields. */
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}
