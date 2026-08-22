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

# --- M-Pesa ---
echo ""
echo "── M-Pesa (Safaricom Daraja) ──"
echo "Get credentials from https://developer.safaricom.co.ke"
read -p "Enter MPESA_CONSUMER_KEY (leave blank to skip): " MPESA_KEY
read -p "Enter MPESA_CONSUMER_SECRET: " MPESA_SECRET
read -p "Enter MPESA_SHORTCODE: " MPESA_SHORTCODE
read -p "Enter MPESA_PASSKEY: " MPESA_PASSKEY

if [[ -n "$MPESA_KEY" ]]; then
  sed -i "s|^MPESA_CONSUMER_KEY=.*|MPESA_CONSUMER_KEY=$MPESA_KEY|" "$ENV_FILE"
  sed -i "s|^MPESA_CONSUMER_SECRET=.*|MPESA_CONSUMER_SECRET=$MPESA_SECRET|" "$ENV_FILE"
  sed -i "s|^MPESA_SHORTCODE=.*|MPESA_SHORTCODE=$MPESA_SHORTCODE|" "$ENV_FILE"
  sed -i "s|^MPESA_PASSKEY=.*|MPESA_PASSKEY=$MPESA_PASSKEY|" "$ENV_FILE"
  log "M-Pesa credentials updated"
fi

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
