import { pool } from './db.js'

async function getTelegramConfig(university) {
  if (!university) return null
  try {
    const result = await pool.query(
      'SELECT telegram_bot_token, telegram_chat_id FROM universities WHERE slug = $1',
      [university]
    )
    const row = result.rows[0]
    if (row?.telegram_bot_token && row?.telegram_chat_id) {
      return { botToken: row.telegram_bot_token, chatId: row.telegram_chat_id }
    }
  } catch {}
  return null
}

export async function sendTelegram(message, university) {
  const cfg = await getTelegramConfig(university)
  if (!cfg) {
    console.log(`[telegram] Skipped — no config for university "${university}"`)
    return
  }
  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[telegram] Send failed:', err)
    } else {
      console.log(`[telegram] Sent to ${university} (chat: ${cfg.chatId})`)
    }
  } catch (err) {
    console.error('[telegram] Error:', err.message)
  }
}

export async function testTelegram(university) {
  const cfg = await getTelegramConfig(university)
  if (!cfg) return { ok: false, error: 'Telegram not configured for this university' }
  try {
    const url = `https://api.telegram.org/bot${cfg.botToken}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: '✅ Lacosta Telegram notifications connected!',
        parse_mode: 'HTML',
      }),
    })
    const data = await res.json()
    if (data.ok) return { ok: true }
    return { ok: false, error: data.description || 'Failed to send test message' }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
