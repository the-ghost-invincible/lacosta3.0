#!/bin/bash
# ============================================================
# Lacosta — Post-Deployment Configuration
# Run this after deploy.sh to set API keys
# ============================================================
# Usage: ./deploy/configure.sh
# ============================================================

set -euo pipefail

APP_DIR="/var/www/lacosta"
ENV_FILE="$APP_DIR/.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Lacosta — Configure API Keys         ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Run deploy.sh first."
  exit 1
fi

# --- Resend API Key ---
echo "── Resend (Email) ──"
echo "Get your API key from https://resend.com/api-keys"
read -p "Enter RESEND_API_KEY (leave blank to skip): " RESEND_KEY
if [[ -n "$RESEND_KEY" ]]; then
  sed -i "s|^RESEND_API_KEY=.*|RESEND_API_KEY=$RESEND_KEY|" "$ENV_FILE"
  log "RESEND_API_KEY updated"
fi

# --- Lipana M-Pesa ---
echo ""
echo "── M-Pesa (Lipana) ──"
echo "Payment credentials are now configured per-university in the admin panel."
echo "After deployment, go to Admin → Payments tab to configure each university's Lipana keys."
echo ""
echo "Steps:"
echo "  1. Sign up at https://lipana.dev"
echo "  2. Get your API key from the Lipana dashboard"
echo "  3. In the admin panel, go to Payments tab for each university"
echo "  4. Enter the API key, webhook secret, and environment"
echo "  5. Copy the webhook URL and add it to your Lipana dashboard"

# --- Restart ---
echo ""
read -p "Restart the app now? (y/n): " RESTART
if [[ "$RESTART" == "y" || "$RESTART" == "Y" ]]; then
  cd "$APP_DIR"
  pm2 restart lacosta-api
  log "App restarted"
fi

echo ""
echo "Done! Check: pm2 logs lacosta-api"
