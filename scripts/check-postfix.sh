#!/bin/bash
# Script to check if postfix is available on the host system
# Uses nc (netcat) to verify SMTP service is actually responding

# Function to check if SMTP service is actually responding using nc
check_smtp_service() {
    local host=$1
    local port=$2
    
    # Use nc (netcat) to verify the service is actually responding
    # -v: verbose, -z: just scan for listening daemons, -w: timeout in seconds
    if command -v nc >/dev/null 2>&1; then
        # Try to connect and check if service responds
        # macOS nc uses -G for timeout, Linux uses -w
        # Try both approaches
        local output
        local exit_code
        
        # Try with -w first (Linux/some Unix)
        if nc -w 2 -vz "$host" "$port" >/dev/null 2>&1; then
            # -w worked, now get the actual output
            output=$(nc -w 2 -vz "$host" "$port" 2>&1)
            exit_code=$?
        else
            # -w didn't work, try -G (macOS)
            output=$(nc -G 2 -vz "$host" "$port" 2>&1)
            exit_code=$?
        fi
        
        # Check if connection succeeded (not refused/failed)
        if [ $exit_code -eq 0 ] && ! echo "$output" | grep -qiE "refused|failed"; then
            return 0
        fi
    elif command -v netcat >/dev/null 2>&1; then
        # Fallback to netcat if nc is not available
        local output
        output=$(netcat -w 2 -vz "$host" "$port" 2>&1)
        local exit_code=$?
        if [ $exit_code -eq 0 ] && ! echo "$output" | grep -qiE "refused|failed"; then
            return 0
        fi
    else
        # Fallback: try basic TCP connection (no timeout, quick attempt)
        bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null
        return $?
    fi
    return 1
}

# Check if postfix is available (installed)
POSTFIX_INSTALLED=false
if command -v postfix >/dev/null 2>&1; then
    POSTFIX_INSTALLED=true
fi

# Check if postfix process is running
POSTFIX_RUNNING=false
if pgrep -x postfix >/dev/null 2>&1; then
    POSTFIX_RUNNING=true
fi

# Check if SMTP service is responding
SMTP_RESPONDING=false
if check_smtp_service "localhost" "25"; then
    SMTP_RESPONDING=true
elif check_smtp_service "localhost" "587"; then
    SMTP_RESPONDING=true
fi

# Determine final status with clear messaging
HOST_POSTFIX_AVAILABLE=false

if [ "$POSTFIX_INSTALLED" = "true" ] && [ "$SMTP_RESPONDING" = "true" ]; then
    HOST_POSTFIX_AVAILABLE=true
    echo "✅ Postfix is available and running on host - will use host postfix" >&2
elif [ "$POSTFIX_INSTALLED" = "true" ] && [ "$POSTFIX_RUNNING" = "true" ] && [ "$SMTP_RESPONDING" = "false" ]; then
    echo "⚠️  Postfix is installed and process is running, but SMTP port (25/587) is not responding" >&2
    echo "   Will use Docker postfix container" >&2
elif [ "$POSTFIX_INSTALLED" = "true" ] && [ "$POSTFIX_RUNNING" = "false" ]; then
    echo "⚠️  Postfix is installed but not running (use 'sudo postfix start' to start it)" >&2
    echo "   Will use Docker postfix container" >&2
elif [ "$POSTFIX_INSTALLED" = "false" ]; then
    echo "⚠️  Postfix is not installed on host system" >&2
    echo "   Will use Docker postfix container" >&2
else
    echo "⚠️  Postfix status unclear - will use Docker postfix container" >&2
fi

# Export result (output to stdout for script usage)
echo "$HOST_POSTFIX_AVAILABLE"

