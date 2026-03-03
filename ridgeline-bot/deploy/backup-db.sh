#!/bin/bash
# Database backup script for Ridgeline
# Usage: /opt/apps/backup-db.sh
# Recommended: set up a cron job to run daily
#   crontab -e → 0 4 * * * /opt/apps/backup-db.sh
set -euo pipefail

BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/ridgeline_${TIMESTAMP}.sql.gz"
KEEP_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "Backing up Ridgeline database..."
sudo -u postgres pg_dump ridgeline | gzip > "$BACKUP_FILE"

echo "Backup saved: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean up old backups
find "$BACKUP_DIR" -name "ridgeline_*.sql.gz" -mtime +${KEEP_DAYS} -delete
echo "Cleaned backups older than ${KEEP_DAYS} days"
