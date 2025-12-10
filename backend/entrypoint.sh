#!/bin/sh
set -e

# If using host postfix, detect gateway IP from Docker network
if [ "$HOST_POSTFIX_AVAILABLE" = "true" ]; then
    echo "🔍 Detecting Docker network gateway for host postfix..."
    
    # Get gateway IP (container's default gateway is the host)
    GATEWAY_IP=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "")
    
    if [ -n "$GATEWAY_IP" ]; then
        export SMTP_HOST="$GATEWAY_IP"
        export SMTP_PORT="${SMTP_PORT:-25}"
        export SMTP_SECURE="${SMTP_SECURE:-false}"
        echo "✅ Using host postfix at: $GATEWAY_IP:$SMTP_PORT"
    else
        echo "⚠️  Could not detect gateway IP, using default"
        export SMTP_HOST="${SMTP_HOST:-host.docker.internal}"
        export SMTP_PORT="${SMTP_PORT:-25}"
        export SMTP_SECURE="${SMTP_SECURE:-false}"
    fi
fi

echo "🔧 Running database migrations..."
npm run db:migrate

echo "🚀 Starting server..."
npm run start