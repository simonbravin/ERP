import { Resend } from 'resend'

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
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ERP Construcción <onboarding@resend.dev>',
      to: [to],
      subject: 'Restablecer contraseña',
      html: `
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p><a href="${resetLink}">Haz clic aquí para restablecer tu contraseña</a></p>
        <p>Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
      `.trim(),
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

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'ERP Construcción <onboarding@resend.dev>',
      to: [to],
      subject: `Invitación a ${orgName}`,
      html: `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
      .content { background: #f9fafb; padding: 30px; }
      .button {
        display: inline-block;
        background: #2563eb;
        color: white;
        padding: 12px 30px;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
      }
      .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 30px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Invitación a ${orgName}</h1>
      </div>
      <div class="content">
        <p>Hola,</p>
        <p>${inviterName} te ha invitado a unirte a <strong>${orgName}</strong> en el sistema de gestión de construcción.</p>
        <p><strong>Rol asignado:</strong> ${role}</p>
        <p>Haz clic en el siguiente botón para aceptar la invitación:</p>
        <p><a href="${invitationUrl}" class="button">Aceptar Invitación</a></p>
        <p style="color: #6b7280; font-size: 14px;">Este enlace expirará en 7 días. Si no solicitaste esta invitación, puedes ignorar este email.</p>
        <p style="font-size: 12px; word-break: break-all;">O copia y pega este enlace en tu navegador:<br>${invitationUrl}</p>
      </div>
      <div class="footer">
        © ${new Date().getFullYear()} ERP Construcción. Todos los derechos reservados.
      </div>
    </div>
  </body>
</html>
      `.trim(),
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
