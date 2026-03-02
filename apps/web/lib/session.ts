import { cache } from 'react'
import { auth } from '@/lib/auth'

/** Cached per request so layout and pages don't call auth() multiple times. */
export const getSession = cache(async function getSession() {
  return auth()
})
