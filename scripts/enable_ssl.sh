#!/usr/bin/env bash
# ==============================================================================
# SafeScholar Automated Free SSL (Let's Encrypt / Certbot) Setup for VPS
# Usage: sudo bash scripts/enable_ssl.sh <YOUR_DOMAIN> <YOUR_EMAIL>
# ==============================================================================

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-admin@safescholar.com}"

if [ -z "$DOMAIN" ]; then
    echo "Usage: sudo bash scripts/enable_ssl.sh <YOUR_DOMAIN> [EMAIL]"
    echo "Example: sudo bash scripts/enable_ssl.sh app.safescholar.io admin@safescholar.io"
    exit 1
fi

echo "Setting up SSL for domain: $DOMAIN..."

# Install certbot
apt-get update -y
apt-get install -y certbot

# Temporarily stop UI container to free port 80 for standalone ACME challenge
docker compose -f docker-compose.hostinger.yml stop ui || true

certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"

# Mount certificate directory and restart UI with SSL enabled
mkdir -p /etc/safescholar/ssl
cp -L "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" /etc/safescholar/ssl/fullchain.pem
cp -L "/etc/letsencrypt/live/$DOMAIN/privkey.pem" /etc/safescholar/ssl/privkey.pem

docker compose -f docker-compose.hostinger.yml up -d

echo "SSL Certificate installed successfully for https://$DOMAIN/"
