import { Resend } from 'resend'
import { config } from './config.js'
import { pool } from './db.js'

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null

function wrapEmail(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    ${body}
  </div>
</body>
</html>`
}

function preheader(text) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;" aria-hidden="true">${text}</div>`
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function ensureDisplayName(email, university) {
  if (email.includes('<') && email.includes('>')) return email
  const label = university
    ? university.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Lacosta'
  return `${label} <${email}>`
}

export async function sendEmail({ to, subject, html, university, unsubscribeUrl, replyTo }) {
  let from = config.emailFrom
  if (university) {
    try {
      const result = await pool.query('SELECT email FROM universities WHERE slug = $1', [university])
      if (result.rows[0]?.email) {
        from = ensureDisplayName(result.rows[0].email, university)
      }
    } catch {}
  } else {
    from = ensureDisplayName(from)
  }
  if (!resend) {
    console.log(`[email-dev] From: ${from} | To: ${to}\nSubject: ${subject}\n`)
    return
  }
  try {
    const wrappedHtml = wrapEmail(html)
    const headers = {}
    if (unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${unsubscribeUrl}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    const params = {
      from,
      to,
      subject,
      html: wrappedHtml,
      text: stripHtml(html),
      headers,
    }
    if (replyTo || config.adminEmail) params.reply_to = replyTo || config.adminEmail
    const { data, error } = await resend.emails.send(params)
    if (error) {
      console.error(`[email-error] To: ${to} | Subject: ${subject}`, error)
    }
  } catch (err) {
    console.error(`[email-failed] To: ${to} | Subject: ${subject}`, err.message)
    console.error(`[email-failed] Full error:`, err)
  }
}
