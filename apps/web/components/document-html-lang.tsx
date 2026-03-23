'use client'

import { useEffect } from 'react'
import { useLocale } from 'next-intl'

/** Sincroniza `<html lang>` con el locale de la ruta (mejora p. ej. el orden en inputs `type="date"`). */
export function DocumentHtmlLang() {
  const locale = useLocale()

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return null
}
