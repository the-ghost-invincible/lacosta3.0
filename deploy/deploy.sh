#!/bin/bash
# ============================================================
# Lacosta — Production Deployment Script for Nescom VPS
# ============================================================
# Usage:
#   1. Upload this project to your VPS (or git clone)
#   2. Run: chmod +x deploy/deploy.sh
#   3. Run: ./deploy/deploy.sh your-domain.com your@email.com
#
# Example:
#   ./deploy/deploy.sh lacosta.co.ke admin@lacosta.co.ke
# ============================================================

set -euo pipefail

# ---- Config (override via args) ----
DOMAIN="${1:?Usage: $0 <domain> <email>}"
ADMIN_EMAIL="${2:?Usage: $0 <domain> <email>}"
APP_DIR="/var/www/lacosta"
NODE_VERSION="22"
DB_NAME="lacosta"
DB_USER="lacosta"
DB_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
ADMIN_PASS=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 20)
ADMIN_SECRET=$(openssl rand -hex 4)

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ---- Preflight checks ----
if [[ $EUID -ne 0 ]]; then
  err "Run this script as root: sudo ./deploy/deploy.sh $DOMAIN $ADMIN_EMAIL"
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Lacosta Production Deployment        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Domain:   $DOMAIN"
echo "  Admin:    $ADMIN_EMAIL"
echo "  App dir:  $APP_DIR"
echo ""

# ============================================================
# 1. SYSTEM UPDATE & DEPENDENCIES
# ============================================================
log "Updating system packages..."
apt update -qq && apt upgrade -y -qq

log "Installing core dependencies..."
apt install -y -qq curl git build-essential ufw

# ============================================================
# 2. INSTALL NODE.JS
# ============================================================
if ! command -v node &>/dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt $NODE_VERSION ]]; then
  log "Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y -qq nodejs
else
  log "Node.js $(node -v) already installed"
fi

# ============================================================
# 3. INSTALL PM2
# ============================================================
if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  npm install -g pm2
else
  log "PM2 already installed"
fi

# ============================================================
# 4. INSTALL NGINX
# ============================================================
if ! command -v nginx &>/dev/null; then
  log "Installing Nginx..."
  apt install -y -qq nginx
fi
systemctl enable nginx
systemctl start nginx

# ============================================================
# 5. INSTALL & SETUP POSTGRESQL
# ============================================================
if ! command -v psql &>/dev/null; then
  log "Installing PostgreSQL..."
  apt install -y -qq postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

log "Creating database user and database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || warn "User $DB_USER already exists"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || warn "Database $DB_NAME already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;" 2>/dev/null || true

# ============================================================
# 6. FIREWALL
# ============================================================
log "Configuring firewall..."
ufw allow OpenSSH >/dev/null 2>&1
ufw allow 'Nginx Full' >/dev/null 2>&1
ufw --force enable >/dev/null 2>&1

# ============================================================
# 7. DEPLOY APPLICATION
# ============================================================
log "Deploying application to $APP_DIR..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"

# Copy files (assuming script is run from project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# If running from project root, copy everything
if [[ -f "$PROJECT_DIR/package.json" ]]; then
  rsync -a --exclude='node_modules' --exclude='.git' --exclude='dist' "$PROJECT_DIR/" "$APP_DIR/"
else
  err "Could not find project root. Run from project directory: ./deploy/deploy.sh $DOMAIN $ADMIN_EMAIL"
fi

cd "$APP_DIR"

# ============================================================
# 8. CREATE ENV FILE
# ============================================================
log "Creating .env file..."
cat > .env <<ENVEOF
# Database
DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# Admin
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_PATH=/admin-$ADMIN_SECRET
PORT=4000

# Domain
BASE_URL=https://$DOMAIN

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM=Lacosta <noreply@$DOMAIN>

# M-Pesa (add later)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://$DOMAIN/api/payments/mpesa/callback
DARAJA_BASE_URL=https://api.safaricom.co.ke

# Error tracking (optional)
SENTRY_DSN=
ENVEOF

# ============================================================
# 9. INSTALL DEPENDENCIES, SEED & BUILD
# ============================================================
log "Installing npm dependencies..."
npm ci --production=false

log "Seeding database..."
npm run seed

log "Building frontend..."
npm run build

# ============================================================
# 10. START WITH PM2
# ============================================================
log "Starting application with PM2..."
pm2 delete lacosta-api 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ============================================================
# 11. CONFIGURE NGINX
# ============================================================
log "Configuring Nginx..."

# Generate nginx config from template
cat > /etc/nginx/sites-available/lacosta <<NGINXEOF
# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

# HTTP → HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    # Certbot ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Static assets (cached forever)
    location /assets/ {
        alias $APP_DIR/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Uploaded images
    location /uploads/ {
        alias $APP_DIR/public/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # API with rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
    }

    # SPA fallback
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Block hidden files
    location ~ /\\. {
        deny all;
    }
}
NGINXEOF

# Remove default site and enable lacosta
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/lacosta /etc/nginx/sites-enabled/

# Test nginx config
nginx -t 2>/dev/null || { err "Nginx config test failed. Check /etc/nginx/sites-available/lacosta"; }
systemctl reload nginx 2>/dev/null || systemctl start nginx

# ============================================================
# 12. SSL WITH CERTBOT
# ============================================================
log "Installing Certbot and obtaining SSL certificate..."
apt install -y -qq certbot python3-certbot-nginx

# First get cert with standalone (before nginx uses the domain)
systemctl stop nginx 2>/dev/null || true
certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect || {
  warn "SSL cert request failed — will retry after DNS propagation"
  warn "Run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
}
systemctl start nginx

# Enable HTTPS in nginx
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect 2>/dev/null || true

# ============================================================
# 13. AUTO-RENEW SSL
# ============================================================
echo "0 0 1 * * root certbot renew --quiet --post-hook 'systemctl reload nginx'" > /etc/cron.d/certbot-renew

# ============================================================
# DONE
# ============================================================
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Deployment Complete!             ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  Site:        https://$DOMAIN"
echo "  Admin panel: https://$DOMAIN$ADMIN_PATH"
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  SAVE THESE CREDENTIALS!                │"
echo "  ├─────────────────────────────────────────┤"
echo "  │  Admin password: $ADMIN_PASS"
echo "  │  Admin path:     /admin-$ADMIN_SECRET"
echo "  │  Database pass:  $DB_PASS"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  Next steps:"
echo "  1. Update RESEND_API_KEY in $APP_DIR/.env"
echo "  2. Update M-Pesa credentials in $APP_DIR/.env"
echo "  3. Run: cd $APP_DIR && pm2 restart lacosta-api"
echo ""
echo "  Useful commands:"
echo "  pm2 logs lacosta-api        # View logs"
echo "  pm2 restart lacosta-api     # Restart app"
echo "  pm2 status                  # Check status"
echo "  nano $APP_DIR/.env          # Edit config"
echo ""
