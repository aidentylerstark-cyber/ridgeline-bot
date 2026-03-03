#!/bin/bash
# Quick-deploy script for Peaches bot
# Usage: /opt/apps/deploy-bot.sh
set -euo pipefail

echo "Deploying Peaches bot..."
cd /opt/apps/ridgeline-bot

git pull origin main
npm install
npm run build

systemctl restart peaches-bot

echo "Bot deployed! Checking status..."
sleep 2
systemctl status peaches-bot --no-pager -l
