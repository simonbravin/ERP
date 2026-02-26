/**
 * HTML → PDF via headless Chromium.
 * Uses puppeteer-core + @sparticuz/chromium for serverless (Vercel).
 * Session is bridged by forwarding request cookies to the headless browser.
 */

import type { Browser } from 'puppeteer-core'

export type RenderPdfOptions = {
  format?: 'A4' | 'Letter'
  margin?: { top?: string; right?: string; bottom?: string; left?: string }
  printBackground?: boolean
}

export type CookieInput = {
  name: string
  value: string
}

const FOOTER_TEMPLATE = `<footer style="width:100%;font-size:9px;padding:0 20px;display:flex;justify-content:space-between;align-items:center;color:#666;">
  <span></span>
  <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  <span>Powered by Bloqer</span>
</footer>`

/**
 * Renders HTML string to PDF. Use with fetchPrintHtml() to avoid cookie/session issues in headless.
 */
export async function renderHtmlToPdf(
  html: string,
  baseUrl: string,
  options: RenderPdfOptions = {}
): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core')
  const isVercel = process.env.VERCEL === '1'
  const isWindows = process.platform === 'win32'
  const useLocal = !isVercel && isWindows
  let executablePath: string
  let args: string[]
  if (useLocal) {
    const { existsSync } = await import('fs')
    const customPath = process.env.PDF_CHROME_PATH
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ]
    executablePath =
      customPath ?? (winPaths.find((p) => existsSync(p)) ?? winPaths[0])
    if (!existsSync(executablePath)) {
      throw new Error(`Chrome no encontrado en ${executablePath}. Definí PDF_CHROME_PATH si está en otra ruta.`)
    }
    args = ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new']
  } else {
    const chromium = await import('@sparticuz/chromium')
    executablePath = await chromium.executablePath()
    args = chromium.args ?? []
  }

  let browser: Browser | null = null
  try {
    browser = await puppeteer.default.launch({
      executablePath,
      args: [...args, '--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    })
    const page = await browser.newPage()
    const htmlWithBase =
      baseUrl && !html.includes('<base ')
        ? html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="${baseUrl}">`)
        : html
    await page.setContent(htmlWithBase, {
      waitUntil: 'load',
      timeout: 15000,
    })
    await page.emulateMediaType('print')
    const margin = options.margin ?? {
      top: '15mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm',
    }
    const pdfBuffer = await page.pdf({
      format: options.format ?? 'A4',
      printBackground: options.printBackground ?? true,
      displayHeaderFooter: true,
      footerTemplate: FOOTER_TEMPLATE,
      margin,
    })
    return Buffer.from(pdfBuffer)
  } finally {
    if (browser) await browser.close()
  }
}

/**
 * Fetches the print page HTML with the given cookie header (same request context = same session).
 */
export async function fetchPrintHtml(url: string, cookieHeader: string | null): Promise<{ html: string; ok: boolean; status: number }> {
  const headers: Record<string, string> = {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (compatible; Bloqer-PDF/1.0)',
  }
  if (cookieHeader) headers['Cookie'] = cookieHeader
  const res = await fetch(url, {
    headers,
    cache: 'no-store',
  })
  const html = await res.text()
  return { html, ok: res.ok, status: res.status }
}

/**
 * Renders a URL (print route) to PDF.
 * Fetches the print page HTML with the request's Cookie header (same session), then converts HTML to PDF.
 * This avoids headless browser cookie/domain issues.
 */
export async function renderUrlToPdf(
  url: string,
  cookies: CookieInput[],
  options: RenderPdfOptions = {},
  cookieHeaderOverride?: string | null
): Promise<Buffer> {
  const cookieHeader =
    cookieHeaderOverride !== undefined
      ? cookieHeaderOverride
      : cookies.length > 0
        ? cookies.map((c) => `${c.name}=${c.value}`).join('; ')
        : null

  const { html, ok, status } = await fetchPrintHtml(url, cookieHeader)
  if (!ok) {
    const snippet = html.includes('Application error') || html.includes('server-side exception')
      ? (html.match(/<body[^>]*>([\s\S]{0,1500})/)?.[1] ?? html.slice(0, 1500))
      : html.slice(0, 800)
    throw new Error(
      `La página de impresión respondió ${status}. ${snippet.replace(/<[^>]+>/g, ' ').slice(0, 400)}`
    )
  }
  const baseUrl = new URL(url).origin + '/'
  return renderHtmlToPdf(html, baseUrl, options)
}
