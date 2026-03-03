#!/bin/bash
# Quick-deploy script for Ridgeline website
# Usage: /opt/apps/deploy-web.sh
set -euo pipefail

echo "Deploying Ridgeline website..."
cd /opt/apps/ridgeline-website

git pull origin main
npm install
npm run build

systemctl restart ridgeline-web

echo "Website deployed! Checking status..."
sleep 2
systemctl status ridgeline-web --no-pager -l
