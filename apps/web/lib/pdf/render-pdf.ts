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

const FOOTER_TEMPLATE =
  "<span style='font-size: 10px; color: #64748b;'>Página <span class='pageNumber'></span> de <span class='totalPages'></span></span>"

/**
 * Renders a URL (print route) to PDF with session cookies so the page renders as the authenticated user.
 * Calls page.emulateMediaType('print') and uses Puppeteer's footerTemplate for "Página X de Y".
 */
export async function renderUrlToPdf(
  url: string,
  cookies: CookieInput[],
  options: RenderPdfOptions = {}
): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core')
  const useLocalChrome = process.env.PDF_USE_LOCAL_CHROME === 'true'
  const isVercel = process.env.VERCEL === '1'

  let browser: Browser | null = null
  try {
    let executablePath: string
    let args: string[]

    if (useLocalChrome) {
      executablePath =
        process.platform === 'win32'
          ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
          : process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/google-chrome'
      args = ['--no-sandbox', '--disable-setuid-sandbox', '--headless=new']
    } else if (isVercel) {
      const chromium = await import('@sparticuz/chromium')
      executablePath = await chromium.executablePath()
      args = chromium.args ?? []
    } else {
      const chromium = await import('@sparticuz/chromium')
      executablePath = await chromium.executablePath()
      args = chromium.args ?? []
    }

    browser = await puppeteer.default.launch({
      executablePath,
      args: [...args, '--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    })

    const page = await browser.newPage()

    if (cookies.length > 0) {
      const parsed = new URL(url)
      const domain = parsed.hostname
      await page.setCookie(
        ...cookies.map((c) => ({
          name: c.name,
          value: c.value,
          domain: domain.startsWith('localhost') ? 'localhost' : `.${domain}`,
        }))
      )
    }

    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
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
