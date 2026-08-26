import { Resend } from 'resend'
import { config } from './config.js'
import { pool } from './db.js'

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null

export async function sendEmail({ to, subject, html, university }) {
  let from = config.emailFrom
  if (university) {
    try {
      const result = await pool.query('SELECT email FROM universities WHERE slug = $1', [university])
      if (result.rows[0]?.email) {
        from = result.rows[0].email
      }
    } catch {}
  }
  if (!resend) {
    console.log(`[email-dev] From: ${from} | To: ${to}\nSubject: ${subject}\n`)
    return
  }
  await resend.emails.send({
    from,
    to,
    subject,
    html,
  })
}
