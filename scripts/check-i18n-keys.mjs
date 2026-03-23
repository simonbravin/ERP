#!/usr/bin/env node
/**
 * Compares flattened key paths between apps/web/messages/es.json and en.json.
 * Exits with code 1 if any key exists in only one file (parity failure).
 *
 * Usage: node scripts/check-i18n-keys.mjs
 *    or: pnpm i18n:check-keys
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(__dirname, '..')
const ES = join(repoRoot, 'apps', 'web', 'messages', 'es.json')
const EN = join(repoRoot, 'apps', 'web', 'messages', 'en.json')

/**
 * @param {Record<string, unknown>} obj
 * @param {string} prefix
 * @returns {Set<string>}
 */
function collectKeys(obj, prefix = '') {
  const keys = new Set()
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return keys
  }
  for (const k of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    const v = obj[k]
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of collectKeys(v, path)) keys.add(sub)
    } else {
      keys.add(path)
    }
  }
  return keys
}

function loadJson(path) {
  const raw = readFileSync(path, 'utf8')
  return JSON.parse(raw)
}

function main() {
  let esObj
  let enObj
  try {
    esObj = loadJson(ES)
    enObj = loadJson(EN)
  } catch (e) {
    console.error('Failed to read or parse message files:', e.message)
    process.exit(2)
  }

  const esKeys = collectKeys(esObj)
  const enKeys = collectKeys(enObj)

  const onlyEs = [...esKeys].filter((k) => !enKeys.has(k)).sort()
  const onlyEn = [...enKeys].filter((k) => !esKeys.has(k)).sort()

  console.log(`i18n key parity: ${esKeys.size} keys in es.json, ${enKeys.size} keys in en.json`)

  if (onlyEs.length === 0 && onlyEn.length === 0) {
    console.log('OK: es.json and en.json have identical key sets.')
    process.exit(0)
  }

  if (onlyEs.length > 0) {
    console.error('\nKeys present only in es.json (missing in en.json):')
    for (const k of onlyEs) console.error(`  - ${k}`)
  }
  if (onlyEn.length > 0) {
    console.error('\nKeys present only in en.json (missing in es.json):')
    for (const k of onlyEn) console.error(`  - ${k}`)
  }

  console.error(
    `\nFix: add the missing keys to the other locale so both files stay in sync.`
  )
  process.exit(1)
}

main()
