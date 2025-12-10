#!/bin/bash
# Utility script to read values from agent.conf
# Usage: ./scripts/read-agent-config.sh <key>
# Example: ./scripts/read-agent-config.sh scanx_version

CONFIG_FILE="${2:-agent/config/agent.conf}"
KEY="${1}"

if [ -z "$KEY" ]; then
    echo "Usage: $0 <key> [config_file]" >&2
    echo "Example: $0 scanx_version" >&2
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found: $CONFIG_FILE" >&2
    exit 1
fi

# Read the value from JSON config
grep -o "\"${KEY}\": \"[^\"]*\"" "$CONFIG_FILE" | cut -d'"' -f4

