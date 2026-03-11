/**
 * Pure helpers for the weekly report email: next week range and HTML body.
 * No 'use server' so they can be used from Inngest and from server actions.
 */

/** Next calendar week: Monday 00:00 to Friday 23:59. */
export function getNextWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay() // 0 Sun, 1 Mon, ..., 6 Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day
  const start = new Date(now)
  start.setDate(start.getDate() + daysUntilMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 4)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

export type WeeklyReportPayloadForEmail = {
  orgName: string
  reportDate: string
  balance: number
  projection: { projectedBalance: number; receivablesDueByDate: number; payablesDueByDate: number }
  payablesNextWeek: number
  receivablesNextWeek: number
  alerts: { title: string; message: string }[]
  projects: {
    projectId: string
    projectName: string
    projectedBalance: number
    payablesNextWeek: number
    receivablesNextWeek: number
  }[]
}

const CURRENCY_OPTS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}

function fmt(n: number): string {
  return n.toLocaleString('es-AR', CURRENCY_OPTS)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Build HTML body for the weekly report email (KPI section + alerts + projects table). */
export function buildWeeklyReportHtml(
  payload: WeeklyReportPayloadForEmail,
  appUrl: string
): string {
  const base = appUrl.replace(/\/$/, '')
  const financeUrl = `${base}/es/finance/cashflow`
  const kpiStyle =
    'background:#f8fafc;border-radius:8px;padding:12px 16px;text-align:center;border:1px solid #e2e8f0;'
  const kpiLabelStyle =
    'font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;'
  const kpiValueStyle = 'font-size:18px;font-weight:700;color:#0f172a;margin:0;'

  let alertsHtml = ''
  if (payload.alerts.length > 0) {
    alertsHtml = `
      <div style="margin:16px 0;">
        <p style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 8px;">Alertas</p>
        <ul style="margin:0;padding-left:20px;color:#64748b;font-size:14px;">
          ${payload.alerts.map((a) => `<li style="margin:4px 0;">${escapeHtml(a.title)}: ${escapeHtml(a.message)}</li>`).join('')}
        </ul>
        <p style="margin:8px 0 0;"><a href="${financeUrl}" style="color:#2563eb;font-size:13px;">Ver finanzas</a></p>
      </div>`
  }

  let tableRows = ''
  if (payload.projects.length > 0) {
    tableRows = payload.projects
      .map(
        (p) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;"><a href="${base}/es/projects/${p.projectId}/finance/cashflow" style="color:#2563eb;text-decoration:none;font-weight:500;">${escapeHtml(p.projectName)}</a></td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(p.projectedBalance)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(p.payablesNextWeek)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-variant-numeric:tabular-nums;">${fmt(p.receivablesNextWeek)}</td>
        </tr>`
      )
      .join('')
  } else {
    tableRows =
      '<tr><td colspan="4" style="padding:16px;text-align:center;color:#64748b;">Sin proyectos</td></tr>'
  }

  return `
    <h1 style="font-size:20px;font-weight:600;color:#0f172a;margin:0 0 8px;">Resumen semanal – ${escapeHtml(payload.orgName)}</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 20px;">${escapeHtml(payload.reportDate)}</p>

    <p style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 10px;">Situación general</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td width="33%" style="vertical-align:top;padding:0 6px 0 0;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Balance actual</p><p style="${kpiValueStyle}">${fmt(payload.balance)}</p></div></td>
        <td width="33%" style="vertical-align:top;padding:0 6px;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Caja proyectada</p><p style="${kpiValueStyle}">${fmt(payload.projection.projectedBalance)}</p></div></td>
        <td width="33%" style="vertical-align:top;padding:0 0 0 6px;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Por cobrar (pendiente)</p><p style="${kpiValueStyle}">${fmt(payload.projection.receivablesDueByDate)}</p></div></td>
      </tr>
      <tr><td colspan="3" style="height:8px;"></td></tr>
      <tr>
        <td width="33%" style="vertical-align:top;padding:0 6px 0 0;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Por pagar (pendiente)</p><p style="${kpiValueStyle}">${fmt(payload.projection.payablesDueByDate)}</p></div></td>
        <td width="33%" style="vertical-align:top;padding:0 6px;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Vence próx. semana</p><p style="${kpiValueStyle}">${fmt(payload.payablesNextWeek)}</p></div></td>
        <td width="33%" style="vertical-align:top;padding:0 0 0 6px;"><div style="${kpiStyle}"><p style="${kpiLabelStyle}">Cobra próx. semana</p><p style="${kpiValueStyle}">${fmt(payload.receivablesNextWeek)}</p></div></td>
      </tr>
    </table>
    ${alertsHtml}

    <p style="font-size:14px;font-weight:600;color:#0f172a;margin:20px 0 10px;">Proyectos</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#475569;">Proyecto</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;">Balance proy.</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;">Vence próx. sem.</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#475569;">Cobra próx. sem.</th>
        </tr>
      </thead>
      <tbody style="font-size:13px;color:#334155;">
        ${tableRows}
      </tbody>
    </table>

    <p style="margin:24px 0 0;"><a href="${base}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;">Abrir Bloqer</a></p>
  `.trim()
}
