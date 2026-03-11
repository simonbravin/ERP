/**
 * Email sending via Resend. All transactional emails use the shared Bloqer template (logo + footer).
 * Notifications sent by email: invitation to org, password reset, added to organization.
 */
import { Resend } from 'resend'

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL ?? 'Bloqer <noreply@bloqer.app>'

/**
 * Builds the absolute URL for the Bloqer logo (used in email HTML).
 * Requires NEXT_PUBLIC_APP_URL so email clients can load the image.
 */
function getLogoUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!base) return null
  return base.replace(/\/$/, '') + '/icon'
}

/**
 * Wraps email body HTML in the shared Bloqer layout (header with logo, footer).
 * Use for all transactional emails so branding is consistent.
 */
export function wrapEmailWithTemplate(contentHtml: string): string {
  const logoUrl = getLogoUrl()
  const year = new Date().getFullYear()
  const headerContent = logoUrl
    ? `<img src="${logoUrl}" alt="Bloqer" width="120" height="40" style="height:40px;width:auto;max-width:120px;display:block;" />`
    : '<span style="font-size:20px;font-weight:600;color:#0f172a;">Bloqer</span>'

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bloqer</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;line-height:1.6;color:#333;background-color:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:24px 24px 16px;text-align:center;border-bottom:1px solid #e2e8f0;">
              ${headerContent}
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
              © ${year} Bloqer. Todos los derechos reservados.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/** Default expiry for password reset tokens (1 hour from now). */
export function getResetTokenExpires(): Date {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  return d
}

export async function sendPasswordResetEmail(params: {
  to: string
  resetToken: string
  resetUrl: string
}): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const { to, resetToken, resetUrl } = params
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey?.trim()) {
    console.warn('[email] RESEND_API_KEY is not set; password reset email skipped.')
    return { ok: false, error: { message: 'Email not configured' } }
  }
  const resend = new Resend(apiKey)
  const resetLink = `${resetUrl}?token=${resetToken}`
  const content = `
    <p style="margin:0 0 12px;">Hola,</p>
    <p style="margin:0 0 12px;">Recibimos una solicitud para restablecer tu contraseña.</p>
    <p style="margin:0 0 16px;"><a href="${resetLink}" style="color:#2563eb;text-decoration:underline;">Haz clic aquí para restablecer tu contraseña</a></p>
    <p style="margin:0;color:#64748b;font-size:14px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
  `.trim()
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Restablecer contraseña',
      html: wrapEmailWithTemplate(content),
    })
    if (error) {
      console.error('Password reset email error:', error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (error) {
    console.error('Password reset email error:', error)
    return { ok: false, error: { message: String(error) } }
  }
}

export async function sendInvitationEmail(params: {
  to: string
  inviterName: string
  orgName: string
  invitationUrl: string
  role: string
}) {
  const { to, inviterName, orgName, invitationUrl, role } = params

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey?.trim()) {
    console.warn('[email] RESEND_API_KEY is not set; invitation email skipped. Add RESEND_API_KEY to .env to enable emails.')
    return { success: false, error: { message: 'Email not configured (RESEND_API_KEY missing)' } }
  }

  const resend = new Resend(apiKey)
  const content = `
    <p style="margin:0 0 12px;">Hola,</p>
    <p style="margin:0 0 12px;">${inviterName} te ha invitado a unirte a <strong>${orgName}</strong> en Bloqer.</p>
    <p style="margin:0 0 12px;"><strong>Rol asignado:</strong> ${role}</p>
    <p style="margin:0 0 16px;">
      <a href="${invitationUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;">Aceptar invitación</a>
    </p>
    <p style="margin:0 0 12px;color:#64748b;font-size:14px;">Este enlace expirará en 7 días. Si no solicitaste esta invitación, puedes ignorar este email.</p>
    <p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all;">O copia y pega este enlace en tu navegador:<br />${invitationUrl}</p>
  `.trim()

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Invitación a ${orgName}`,
      html: wrapEmailWithTemplate(content),
    })

    if (error) {
      console.error('Error sending email:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Email error:', error)
    return { success: false, error }
  }
}

/**
 * Send email when an existing user is added to an organization (no invitation flow).
 * Notifications sent by email currently: invitation, password reset, added to organization.
 */
export async function sendAddedToOrgEmail(params: {
  to: string
  orgName: string
}) {
  const { to, orgName } = params
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey?.trim()) {
    console.warn('[email] RESEND_API_KEY is not set; added-to-org email skipped.')
    return { success: false, error: { message: 'Email not configured' } }
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') ?? ''
  const content = `
    <p style="margin:0 0 12px;">Hola,</p>
    <p style="margin:0 0 12px;">Te han añadido a la organización <strong>${orgName}</strong> en Bloqer.</p>
    <p style="margin:0 0 16px;">
      ${appUrl ? `<a href="${appUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:500;">Ir a Bloqer</a>` : 'Inicia sesión en la aplicación para acceder.'}
    </p>
  `.trim()

  const resend = new Resend(apiKey)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Te han añadido a ${orgName}`,
      html: wrapEmailWithTemplate(content),
    })
    if (error) {
      console.error('Added-to-org email error:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (error) {
    console.error('Added-to-org email error:', error)
    return { success: false, error }
  }
}

/**
 * Send the weekly report email (HTML body already built). Used by Inngest cron.
 */
export async function sendWeeklyReportEmail(params: {
  to: string
  subject: string
  contentHtml: string
}): Promise<{ success: true; data?: { id?: string } } | { success: false; error: { message: string } }> {
  const { to, subject, contentHtml } = params
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set; weekly report skipped.')
    return { success: false, error: { message: 'Email not configured' } }
  }
  const resend = new Resend(apiKey)
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: wrapEmailWithTemplate(contentHtml),
    })
    if (error) {
      console.error('Weekly report email error:', error)
      return { success: false, error }
    }
    return { success: true, data }
  } catch (err) {
    console.error('Weekly report email error:', err)
    return { success: false, error: { message: String(err) } }
  }
}
