// ===== ADMIN CONFIGURATION =====
// Change these to secure your admin panel.
// The admin page lives at: http://localhost:<PORT>/admin-7f3k9
// (the secret path is cosmetic — the password is the real gate)

export const config = {
  port: Number(process.env.PORT) || 4000,
  adminPassword: process.env.ADMIN_PASSWORD ?? 'lacosta-admin',
  adminPath: process.env.ADMIN_PATH ?? '/admin-7f3k9',
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  emailFrom: process.env.EMAIL_FROM ?? 'Lacosta <noreply@localhost>',
  baseUrl: process.env.BASE_URL ?? 'http://localhost:4000',
}