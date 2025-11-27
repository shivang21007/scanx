#!/bin/bash

# Rate Limiting Test Script
# This script tests the nginx rate limiting configuration

# Colors for output (define first)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "Rate Limiting Test Script"
echo "=========================================="
echo ""

# Configuration
RAW_URL="${1:-http://localhost}"
API_ENDPOINT="/api/devices"
AUTH_ENDPOINT="/api/auth/login"

# Normalize URL - add http:// if missing, remove trailing paths
if [[ ! "$RAW_URL" =~ ^https?:// ]]; then
    RAW_URL="http://$RAW_URL"
fi

# Extract just the base URL (remove any paths after domain:port)
BASE_URL=$(echo "$RAW_URL" | sed -E 's|(https?://[^/]+).*|\1|')

# Check if Docker container is running
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "frontend\|scanx"; then
        echo "${GREEN}✓ Docker container detected${NC}"
        echo ""
    fi
fi

# Note about port 5173 (Docker maps host:5173 -> container:80)
if echo "$BASE_URL" | grep -q ":5173"; then
    echo "${GREEN}ℹ Testing against Docker nginx (host port 5173 -> container port 80)${NC}"
    echo ""
fi

echo "Testing against: $BASE_URL"
echo "API Endpoint: $BASE_URL$API_ENDPOINT"
echo ""

# Test 1: General API Rate Limiting (100 req/min)
echo "=========================================="
echo "Test 1: General API Rate Limiting"
echo "Expected: 100 req/min (burst=10)"
echo "=========================================="

success_count=0
rate_limited_count=0
other_count=0

echo "Sending 120 requests rapidly to $API_ENDPOINT..."
echo "Note: Sending requests quickly to trigger rate limit..."
echo ""

# Send requests in parallel batches to trigger rate limiting faster
for i in {1..120}; do
    # Send request and capture response code
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL$API_ENDPOINT" 2>/dev/null)
    
    if [ "$response" == "200" ] || [ "$response" == "401" ] || [ "$response" == "404" ] || [ "$response" == "403" ]; then
        ((success_count++))
        echo -ne "${GREEN}✓${NC}"
    elif [ "$response" == "429" ]; then
        ((rate_limited_count++))
        echo -ne "${RED}✗${NC}"
    elif [ -z "$response" ]; then
        echo -ne "${YELLOW}?${NC}"
        ((other_count++))
    else
        echo -ne "${YELLOW}?($response)${NC}"
        ((other_count++))
    fi
    
    # Print newline every 20 requests
    if [ $((i % 20)) -eq 0 ]; then
        echo " ($i/120) - Success: $success_count, Rate Limited: $rate_limited_count"
    fi
    
    # Small delay to avoid overwhelming, but fast enough to trigger rate limit
    sleep 0.1
done

echo ""
echo ""
echo "Results:"
echo "  Success (200/401/404): ${GREEN}$success_count${NC}"
echo "  Rate Limited (429): ${RED}$rate_limited_count${NC}"
if [ $other_count -gt 0 ]; then
    echo "  Other responses: ${YELLOW}$other_count${NC}"
fi
echo ""

if [ $rate_limited_count -gt 0 ]; then
    echo "${GREEN}✓ Rate limiting is working! Got $rate_limited_count rate limit responses.${NC}"
    echo "${GREEN}✓ Check nginx logs: docker logs frontend-scanx-1 | grep 'limiting requests'${NC}"
else
    echo "${YELLOW}⚠ No 429 responses detected.${NC}"
    echo "${YELLOW}⚠ This could mean:${NC}"
    echo "${YELLOW}   - Requests are too slow (rate limit is 100/min = ~1.67/sec)${NC}"
    echo "${YELLOW}   - Rate limit hasn't been reached yet${NC}"
    echo "${YELLOW}   - Check nginx logs: docker logs frontend-scanx-1${NC}"
fi

echo ""
echo "=========================================="
echo "Quick Rapid Test (10 requests in 1 second)"
echo "This should trigger rate limiting immediately"
echo "=========================================="

rapid_success=0
rapid_limited=0

echo "Sending 10 rapid requests..."
for i in {1..10}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$BASE_URL$API_ENDPOINT" 2>/dev/null)
    if [ "$response" == "429" ]; then
        ((rapid_limited++))
        echo -ne "${RED}✗${NC}"
    else
        ((rapid_success++))
        echo -ne "${GREEN}✓${NC}"
    fi
done
echo ""
echo "Rapid test results: Success: $rapid_success, Rate Limited: $rapid_limited"
if [ $rapid_limited -gt 0 ]; then
    echo "${GREEN}✓ Rate limiting confirmed working!${NC}"
fi
echo ""

echo "=========================================="
echo "Test 2: Auth Endpoint Rate Limiting"
echo "Expected: 10 req/min (burst=5)"
echo "=========================================="

auth_success=0
auth_limited=0

echo "Sending 20 requests to $AUTH_ENDPOINT..."
for i in {1..20}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$AUTH_ENDPOINT" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test"}' 2>/dev/null)
    
    if [ "$response" == "200" ] || [ "$response" == "401" ] || [ "$response" == "400" ]; then
        ((auth_success++))
        echo -ne "${GREEN}✓${NC}"
    elif [ "$response" == "429" ]; then
        ((auth_limited++))
        echo -ne "${RED}✗${NC}"
    else
        echo -ne "${YELLOW}?${NC}"
    fi
    
    # Print newline every 10 requests
    if [ $((i % 10)) -eq 0 ]; then
        echo " ($i/20)"
    fi
done

echo ""
echo ""
echo "Results:"
echo "  Success: ${GREEN}$auth_success${NC}"
echo "  Rate Limited (429): ${RED}$auth_limited${NC}"
echo ""

if [ $auth_limited -gt 0 ]; then
    echo "${GREEN}✓ Auth rate limiting is working!${NC}"
else
    echo "${YELLOW}⚠ Warning: No auth rate limiting detected.${NC}"
fi

echo ""
echo "=========================================="
echo "Test 3: Verify 429 Error Page Content"
echo "=========================================="

echo "Triggering rate limit and checking for custom 429 page..."
# Send many rapid requests to trigger rate limit
for i in {1..120}; do
    curl -s -o /dev/null --max-time 2 "$BASE_URL$API_ENDPOINT" 2>/dev/null
done

# Wait a moment for rate limit to be active
sleep 0.5

# Now check if we get the custom 429 page with proper status code
echo "Testing 429 page response..."
response=$(curl -s -w "\nHTTP_CODE:%{http_code}\n" "$BASE_URL$API_ENDPOINT" 2>/dev/null)
http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
response_body=$(echo "$response" | grep -v "HTTP_CODE:")

# Check multiple indicators that 429.html is being served
checks_passed=0
checks_total=5

echo "Checking response..."
if [ "$http_code" == "429" ]; then
    echo "  ${GREEN}✓ HTTP Status Code: 429${NC}"
    ((checks_passed++))
else
    echo "  ${RED}✗ HTTP Status Code: $http_code (expected 429)${NC}"
fi

if echo "$response_body" | grep -qi "Too Many Requests"; then
    echo "  ${GREEN}✓ Contains 'Too Many Requests' text${NC}"
    ((checks_passed++))
else
    echo "  ${RED}✗ Missing 'Too Many Requests' text${NC}"
fi

if echo "$response_body" | grep -qi "429"; then
    echo "  ${GREEN}✓ Contains '429' error code${NC}"
    ((checks_passed++))
else
    echo "  ${RED}✗ Missing '429' error code${NC}"
fi

if echo "$response_body" | grep -qi "countdown"; then
    echo "  ${GREEN}✓ Contains countdown timer element${NC}"
    ((checks_passed++))
else
    echo "  ${YELLOW}⚠ Missing countdown timer (may be in script)${NC}"
fi

if echo "$response_body" | grep -qi "<!DOCTYPE html>"; then
    echo "  ${GREEN}✓ Valid HTML document${NC}"
    ((checks_passed++))
else
    echo "  ${RED}✗ Not a valid HTML document${NC}"
fi

echo ""
if [ $checks_passed -ge 3 ]; then
    echo "${GREEN}✓ Custom 429 error page is being served correctly!${NC}"
    echo "${GREEN}  ($checks_passed/$checks_total checks passed)${NC}"
    
    # Show a snippet of the response
    echo ""
    echo "Response preview (first 3 lines):"
    echo "$response_body" | head -3 | sed 's/^/  /'
else
    echo "${YELLOW}⚠ Custom 429 page may not be working correctly.${NC}"
    echo "${YELLOW}  ($checks_passed/$checks_total checks passed)${NC}"
    echo ""
    echo "Response preview:"
    echo "$response_body" | head -10 | sed 's/^/  /'
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo "Rate limiting configuration:"
echo "  • Auth endpoints: 10 req/min (burst=5)"
echo "  • General API: 100 req/min (burst=10)"
echo "  • Agent data: 100 req/min (burst=20)"
echo ""
echo "Total test results:"
echo "  • General API: $success_count success, $rate_limited_count rate limited"
echo "  • Auth endpoint: $auth_success success, $auth_limited rate limited"
echo ""

# Check nginx logs if Docker is available
if command -v docker &> /dev/null; then
    if docker ps --format '{{.Names}}' | grep -q "frontend\|scanx"; then
        CONTAINER_NAME=$(docker ps --format '{{.Names}}' | grep -E "frontend|scanx" | head -1)
        echo "Recent rate limiting events from nginx logs:"
        docker logs "$CONTAINER_NAME" 2>&1 | grep -i "limiting requests" | tail -5 | sed 's/^/  /' || echo "  (No recent rate limit events)"
        echo ""
    fi
fi

echo "Test completed!"
echo "=========================================="

