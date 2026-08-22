import { Resend } from 'resend'
import { config } from './config.js'

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.log(`[email-dev] To: ${to}\nSubject: ${subject}\n`)
    return
  }
  await resend.emails.send({
    from: config.emailFrom,
    to,
    subject,
    html,
  })
}
