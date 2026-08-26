#!/bin/bash
# ============================================================
# Lacosta — Production Deployment Script
# ============================================================
# Usage:
#   sudo ./deploy/deploy.sh your-domain.com admin@email.com
# ============================================================

set -euo pipefail

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

if [[ $EUID -ne 0 ]]; then
  err "Run as root: sudo ./deploy/deploy.sh $DOMAIN $ADMIN_EMAIL"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

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
DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
ADMIN_PASSWORD=$ADMIN_PASS
ADMIN_PATH=/admin-$ADMIN_SECRET
PORT=4000
BASE_URL=https://$DOMAIN
RESEND_API_KEY=
EMAIL_FROM=Lacosta <noreply@$DOMAIN>
ADMIN_EMAIL=$ADMIN_EMAIL
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
# 11. NGINX — HTTP-only first (so nginx can start without SSL certs)
# ============================================================
log "Configuring Nginx (HTTP)..."

cat > /etc/nginx/sites-available/lacosta <<NGINXEOF
# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

# HTTP server (temporary — certbot will add HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
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

    location ~ /\\. {
        deny all;
    }
}
NGINXEOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/lacosta /etc/nginx/sites-enabled/

nginx -t || err "Nginx config test failed"
systemctl reload nginx

# ============================================================
# 12. SSL WITH CERTBOT
# ============================================================
log "Installing Certbot..."
apt install -y -qq certbot python3-certbot-nginx

log "Obtaining SSL certificate..."
systemctl stop nginx 2>/dev/null || true
certbot certonly --standalone -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$ADMIN_EMAIL" || {
  warn "SSL cert request failed — DNS may not have propagated yet."
  warn "After DNS points here, run: certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN"
  warn "Then re-run this script, or run: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  systemctl start nginx
  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║  Partial deploy — SSL not configured     ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""
  echo "  Site is running on HTTP only."
  echo "  Fix DNS, then run:"
  echo "    certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  echo ""
  echo "  Admin password: $ADMIN_PASS"
  echo "  Admin path:     /admin-$ADMIN_SECRET"
  echo "  Database pass:  $DB_PASS"
  echo ""
  exit 0
}
systemctl start nginx

# ============================================================
# 13. FULL HTTPS NGINX CONFIG
# ============================================================
log "Applying HTTPS Nginx config..."

cat > /etc/nginx/sites-available/lacosta <<NGINXEOF
limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    location /assets/ {
        alias $APP_DIR/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /uploads/ {
        alias $APP_DIR/public/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

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

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~ /\\. {
        deny all;
    }
}
NGINXEOF

nginx -t && systemctl reload nginx

# ============================================================
# 14. AUTO-RENEW SSL
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
