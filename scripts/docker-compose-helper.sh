#!/bin/bash
# Helper script to run docker compose with versions from agent.conf
# Usage: ./scripts/docker-compose-helper.sh [docker compose commands]
# Example: ./scripts/docker-compose-helper.sh up -d

# Read versions from agent.conf
SCANX_VERSION=$(./scripts/read-agent-config.sh scanx_version)
OSQUERYI_VERSION=$(./scripts/read-agent-config.sh osqueryi_version)
OSQUERY_BINARY_REQUIRED=${OSQUERY_BINARY_REQUIRED:-false}

if [ -z "$SCANX_VERSION" ]; then
    echo "❌ Error: scanx_version not found in agent/config/agent.conf"
    exit 1
fi
if [ -z "$OSQUERYI_VERSION" ]; then
    echo "❌ Error: osqueryi_version not found in agent/config/agent.conf"
    exit 1
fi

echo "📦 Using scanx_version from agent.conf: $SCANX_VERSION"
echo "📦 Using osqueryi_version from agent.conf: $OSQUERYI_VERSION"
echo "🔧 OSQUERY_BINARY_REQUIRED: $OSQUERY_BINARY_REQUIRED"

# Check if postfix is available on host
echo "🔍 Checking for postfix on host system..."
HOST_POSTFIX_AVAILABLE=$(./scripts/check-postfix.sh)

if [ "$HOST_POSTFIX_AVAILABLE" = "true" ]; then
    echo "✅ Using host postfix (gateway IP will be detected by backend entrypoint)"
    # Don't start postfix container - backend will detect gateway IP on startup
    export COMPOSE_PROFILES=""
    export HOST_POSTFIX_AVAILABLE="true"
else
    echo "📦 Host postfix not found - using Docker postfix container"
    # Use Docker postfix container - backend can access via service name
    export SMTP_HOST="postfix"
    export SMTP_PORT="25"
    export SMTP_SECURE="false"
    # Enable postfix container profile
    export COMPOSE_PROFILES="postfix-container"
    export HOST_POSTFIX_AVAILABLE="false"
    POSTFIX_ALLOWED_DOMAINS="${POSTFIX_ALLOWED_DOMAINS:-octro.com octrotalk.com localhost}"
    export POSTFIX_ALLOWED_DOMAINS
fi

# Export variables for docker compose
export SCANX_VERSION
export OSQUERYI_VERSION
export OSQUERY_BINARY_REQUIRED

# Run docker compose with all arguments
docker compose "$@"

# After docker compose commands, clean up postfix container if using host postfix
if [ "$HOST_POSTFIX_AVAILABLE" = "true" ] && [[ "$*" =~ (down|stop) ]]; then
    if docker ps -a --format '{{.Names}}' | grep -q "^postfix-scanx-1$"; then
        echo "🛑 Cleaning up postfix container (not needed when using host postfix)..."
        docker stop postfix-scanx-1 2>/dev/null || true
        docker rm postfix-scanx-1 2>/dev/null || true
    fi
fi

