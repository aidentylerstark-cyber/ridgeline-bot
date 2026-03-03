#!/bin/bash
# =============================================================================
# Hetzner VPS Setup Script for Ridgeline (Peaches Bot + Website)
# Target: Ubuntu 22.04 LTS, Hetzner CX22, Ashburn VA
#
# Usage: ssh root@YOUR_VPS_IP 'bash -s' < hetzner-setup.sh
#   OR:  scp hetzner-setup.sh root@YOUR_VPS_IP:~ && ssh root@YOUR_VPS_IP ./hetzner-setup.sh
#
# This script is idempotent — safe to run multiple times.
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }
info() { echo -e "${CYAN}[→]${NC} $1"; }

echo ""
echo "============================================="
echo "  Ridgeline VPS Setup — Hetzner CX22"
echo "  Ubuntu 22.04 LTS"
echo "============================================="
echo ""

# ─────────────────────────────────────────────
# Phase 1: System Packages
# ─────────────────────────────────────────────
info "Phase 1: System packages & firewall"

apt-get update -qq
apt-get upgrade -y -qq

# Install essentials
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ufw lsb-release gnupg2 > /dev/null
log "System packages installed"

# Firewall
if ! ufw status | grep -q "Status: active"; then
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
  log "Firewall configured (SSH + HTTP + HTTPS)"
else
  ufw allow 80/tcp > /dev/null 2>&1
  ufw allow 443/tcp > /dev/null 2>&1
  log "Firewall already active, rules verified"
fi

# ─────────────────────────────────────────────
# Phase 1b: Node.js 20
# ─────────────────────────────────────────────
if ! command -v node &> /dev/null || [[ "$(node -v)" != v20* ]]; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null
  log "Node.js $(node -v) installed"
else
  log "Node.js $(node -v) already installed"
fi

# ─────────────────────────────────────────────
# Phase 1c: PostgreSQL 16
# ─────────────────────────────────────────────
if ! command -v psql &> /dev/null || ! psql --version | grep -q "16"; then
  info "Installing PostgreSQL 16..."
  echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg 2>/dev/null
  apt-get update -qq
  apt-get install -y -qq postgresql-16 > /dev/null
  systemctl enable postgresql
  systemctl start postgresql
  log "PostgreSQL 16 installed and running"
else
  log "PostgreSQL 16 already installed"
fi

# ─────────────────────────────────────────────
# Phase 2: Database Setup
# ─────────────────────────────────────────────
info "Phase 2: Database setup"

# Prompt for database password
if [ -t 0 ]; then
  # Interactive mode
  read -sp "Enter a password for the 'ridgeline' database user: " DB_PASSWORD
  echo ""
else
  # Non-interactive — generate a random password
  DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
  warn "Generated random DB password: $DB_PASSWORD"
  warn "Save this password — you'll need it for .env files!"
fi

# Create user and database (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = 'ridgeline'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ridgeline WITH PASSWORD '${DB_PASSWORD}';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'ridgeline'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ridgeline OWNER ridgeline;"

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ridgeline TO ridgeline;" > /dev/null 2>&1
log "Database 'ridgeline' and user created"

DATABASE_URL="postgresql://ridgeline:${DB_PASSWORD}@localhost:5432/ridgeline"

# ─────────────────────────────────────────────
# Phase 3: Deploy Bot
# ─────────────────────────────────────────────
info "Phase 3: Deploy Peaches bot"

mkdir -p /opt/apps

if [ ! -d /opt/apps/ridgeline-bot ]; then
  git clone https://github.com/aidentylerstark-cyber/ridgeline-bot.git /opt/apps/ridgeline-bot
  log "Bot repo cloned"
else
  cd /opt/apps/ridgeline-bot && git pull origin main
  log "Bot repo updated"
fi

cd /opt/apps/ridgeline-bot
npm install --omit=dev --ignore-scripts 2>/dev/null || npm install
log "Bot dependencies installed"

npm run build
log "Bot built successfully"

# Create .env if it doesn't exist
if [ ! -f /opt/apps/ridgeline-bot/.env ]; then
  cat > /opt/apps/ridgeline-bot/.env << ENVEOF
DISCORD_BOT_TOKEN=PASTE_YOUR_BOT_TOKEN_HERE
DATABASE_URL=${DATABASE_URL}
ANTHROPIC_API_KEY=PASTE_YOUR_ANTHROPIC_KEY_HERE
PORT=3001
ENVEOF
  warn "Bot .env created — you MUST edit it to add your secrets:"
  warn "  nano /opt/apps/ridgeline-bot/.env"
else
  log "Bot .env already exists (not overwritten)"
fi

# Install systemd service
cat > /etc/systemd/system/peaches-bot.service << 'SVCEOF'
[Unit]
Description=Peaches Discord Bot
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/apps/ridgeline-bot
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=peaches-bot
EnvironmentFile=/opt/apps/ridgeline-bot/.env

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/apps/ridgeline-bot
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable peaches-bot
log "Bot systemd service installed and enabled"

# ─────────────────────────────────────────────
# Phase 4: Deploy Website
# ─────────────────────────────────────────────
info "Phase 4: Deploy Ridgeline website"

# NOTE: Update this URL to the actual website repo if it's different from the bot repo
WEBSITE_REPO="https://github.com/aidentylerstark-cyber/ridgeline-bot.git"

if [ ! -d /opt/apps/ridgeline-website ]; then
  warn "Website repo needs to be cloned manually."
  warn "The website lives at the workspace root (separate from the bot)."
  warn "Run: git clone YOUR_WEBSITE_REPO_URL /opt/apps/ridgeline-website"
  mkdir -p /opt/apps/ridgeline-website
else
  log "Website directory exists"
fi

# Create website .env if directory exists and .env doesn't
if [ -d /opt/apps/ridgeline-website ] && [ ! -f /opt/apps/ridgeline-website/.env ]; then
  cat > /opt/apps/ridgeline-website/.env << ENVEOF
DATABASE_URL=${DATABASE_URL}
NODE_ENV=production
PORT=5000
ENVEOF
  log "Website .env created"
fi

# Install website systemd service
cat > /etc/systemd/system/ridgeline-web.service << 'SVCEOF'
[Unit]
Description=Ridgeline Website
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/apps/ridgeline-website
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ridgeline-web
EnvironmentFile=/opt/apps/ridgeline-website/.env

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/apps/ridgeline-website
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable ridgeline-web
log "Website systemd service installed and enabled"

# ─────────────────────────────────────────────
# Phase 5: Nginx Reverse Proxy
# ─────────────────────────────────────────────
info "Phase 5: Nginx reverse proxy"

cat > /etc/nginx/sites-available/ridgeline << 'NGINXEOF'
# Ridgeline Website — ridgelinesl.com
server {
    listen 80;
    server_name ridgelinesl.com www.ridgelinesl.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}

# Region Webhook API — api.ridgelinesl.com
server {
    listen 80;
    server_name api.ridgelinesl.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Smaller timeouts for API
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
}
NGINXEOF

# Enable site, disable default
ln -sf /etc/nginx/sites-available/ridgeline /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  log "Nginx configured and reloaded"
else
  err "Nginx config test failed — check with: nginx -t"
fi

# ─────────────────────────────────────────────
# Deploy Scripts
# ─────────────────────────────────────────────
info "Installing deploy helper scripts"

cat > /opt/apps/deploy-bot.sh << 'DEPLOYEOF'
#!/bin/bash
set -euo pipefail
echo "🍑 Deploying Peaches bot..."
cd /opt/apps/ridgeline-bot
git pull origin main
npm install
npm run build
systemctl restart peaches-bot
echo "✓ Bot deployed! Checking status..."
sleep 2
systemctl status peaches-bot --no-pager -l
DEPLOYEOF
chmod +x /opt/apps/deploy-bot.sh

cat > /opt/apps/deploy-web.sh << 'DEPLOYEOF'
#!/bin/bash
set -euo pipefail
echo "🌐 Deploying Ridgeline website..."
cd /opt/apps/ridgeline-website
git pull origin main
npm install
npm run build
systemctl restart ridgeline-web
echo "✓ Website deployed! Checking status..."
sleep 2
systemctl status ridgeline-web --no-pager -l
DEPLOYEOF
chmod +x /opt/apps/deploy-web.sh

log "Deploy scripts installed at /opt/apps/deploy-bot.sh and /opt/apps/deploy-web.sh"

# ─────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────
echo ""
echo "============================================="
echo "  Setup Complete!"
echo "============================================="
echo ""
echo "  Database URL: ${DATABASE_URL}"
echo ""
echo "  Next steps:"
echo "  ─────────────────────────────────────────"
echo "  1. IMPORT DATABASE from Railway:"
echo "     pg_dump \"RAILWAY_DATABASE_URL\" --no-owner --no-acl > backup.sql"
echo "     psql -U ridgeline -d ridgeline -f backup.sql"
echo ""
echo "  2. EDIT BOT SECRETS:"
echo "     nano /opt/apps/ridgeline-bot/.env"
echo "     (add DISCORD_BOT_TOKEN and ANTHROPIC_API_KEY)"
echo ""
echo "  3. CLONE & BUILD WEBSITE (if not done):"
echo "     cd /opt/apps/ridgeline-website"
echo "     git clone YOUR_REPO . && npm install && npm run build"
echo ""
echo "  4. START SERVICES:"
echo "     systemctl start peaches-bot"
echo "     systemctl start ridgeline-web"
echo ""
echo "  5. GET SSL CERTIFICATES:"
echo "     certbot --nginx -d ridgelinesl.com -d www.ridgelinesl.com"
echo "     certbot --nginx -d api.ridgelinesl.com"
echo ""
echo "  6. UPDATE DNS:"
echo "     ridgelinesl.com      → A → $(curl -s ifconfig.me)"
echo "     www.ridgelinesl.com  → A → $(curl -s ifconfig.me)"
echo "     api.ridgelinesl.com  → A → $(curl -s ifconfig.me)"
echo ""
echo "  Useful commands:"
echo "  ─────────────────────────────────────────"
echo "  journalctl -u peaches-bot -f    # Bot logs"
echo "  journalctl -u ridgeline-web -f  # Website logs"
echo "  systemctl status peaches-bot    # Bot status"
echo "  systemctl status ridgeline-web  # Website status"
echo "  /opt/apps/deploy-bot.sh         # Redeploy bot"
echo "  /opt/apps/deploy-web.sh         # Redeploy website"
echo ""
