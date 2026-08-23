#!/bin/bash
# Lacosta deployment script
# Run this on your server (Ubuntu/Debian) as root or with sudo

set -e

APP_DIR="/var/www/lacosta"
NODE_VERSION="22"
DB_NAME="lacosta"
DB_USER="lacosta"
DB_PASS="$(openssl rand -base64 24)"

echo "=== Lacosta Deployment ==="
echo ""

# 1. System updates
echo "[1/8] Updating system..."
apt update && apt upgrade -y

# 2. Install Node.js
echo "[2/8] Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt install -y nodejs
fi

# 3. Install PM2
echo "[3/8] Installing PM2..."
npm install -g pm2

# 4. Install Nginx
echo "[4/8] Installing Nginx..."
apt install -y nginx

# 5. Install PostgreSQL
echo "[5/8] Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib

# 6. Setup database
echo "[6/8] Setting up database..."
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# 7. Deploy app
echo "[7/8] Deploying application..."
mkdir -p $APP_DIR
cp -r . $APP_DIR/
cd $APP_DIR

# Create .env file
cat > .env <<EOF
DATABASE_URL=postgres://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
ADMIN_PASSWORD=$(openssl rand -base64 16)
ADMIN_PATH=/admin-$(openssl rand -hex 4)
PORT=4000
BASE_URL=https://your-domain.com
RESEND_API_KEY=your-resend-key
EMAIL_FROM=Lacosta <noreply@your-domain.com>
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_SHORTCODE=
MPESA_PASSKEY=
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
DARAJA_BASE_URL=https://api.safaricom.co.ke
SENTRY_DSN=
EOF

# Install deps and build
npm ci --production
npm run seed
npm run build

# 8. Setup services
echo "[8/8] Starting services..."
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup

# Setup Nginx
cp deploy/nginx.conf /etc/nginx/sites-available/lacosta
# Replace placeholders with actual values
sed -i "s|DOMAIN_PLACEHOLDER|$DOMAIN|g" /etc/nginx/sites-available/lacosta
sed -i "s|/var/www/lacosta|$APP_DIR|g" /etc/nginx/sites-available/lacosta

ln -sf /etc/nginx/sites-available/lacosta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Setup SSL with certbot
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com --non-interactive --agree-tos -m your@email.com

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Database password (save this!): $DB_PASS"
echo "Admin panel: https://your-domain.com$ADMIN_PATH"
echo ""
echo "Next steps:"
echo "1. Update DNS to point to this server's IP"
echo "2. Replace 'your-domain.com' in /etc/nginx/sites-available/lacosta"
echo "3. Run: certbot --nginx -d your-domain.com -d www.your-domain.com"
echo "4. Update .env with your actual domain, Resend key, and M-Pesa credentials"
echo "5. Run: pm2 restart lacosta-api"
