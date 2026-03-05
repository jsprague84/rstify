#!/bin/bash
# rstify Production Testing Script
# Tests the production instance at https://rstify.js-node.cc

BASE_URL="https://rstify.js-node.cc"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}rstify Production Testing Report${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Testing instance: $BASE_URL"
echo "Test started: $(date)"
echo ""

# Test function
test_endpoint() {
    local method=$1
    local path=$2
    local description=$3
    local expected_status=${4:-200}
    local data=$5

    echo -e "\n${YELLOW}Testing: $description${NC}"
    echo "URL: $BASE_URL$path"

    # Measure time and get response
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" "$BASE_URL$path" 2>&1)
    else
        response=$(curl -s -X "$method" -w "\nHTTP_CODE:%{http_code}\nTIME:%{time_total}" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$path" 2>&1)
    fi

    # Extract HTTP code and time
    http_code=$(echo "$response" | grep "HTTP_CODE:" | cut -d: -f2)
    time_total=$(echo "$response" | grep "TIME:" | cut -d: -f2)
    body=$(echo "$response" | sed '/HTTP_CODE:/d' | sed '/TIME:/d')

    # Check if successful
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ Success${NC}"
    else
        echo -e "${RED}✗ Failed${NC}"
    fi

    echo "  Status: $http_code (expected: $expected_status)"
    echo "  Response time: ${time_total}s"
    echo "  Response: $(echo $body | head -c 200)"

    # Return status
    [ "$http_code" == "$expected_status" ]
}

# Initialize counters
total=0
passed=0
failed=0

# Test 1: Health & Version
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}1. Health & Version Checks${NC}"
echo -e "${BLUE}============================================================${NC}"

test_endpoint "GET" "/health" "Health endpoint" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

test_endpoint "GET" "/version" "Version endpoint" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Test 2: Web UI
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}2. Web UI Tests${NC}"
echo -e "${BLUE}============================================================${NC}"

test_endpoint "GET" "/" "Web UI home page" 200
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Test 3: Authentication
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}3. Authentication Tests${NC}"
echo -e "${BLUE}============================================================${NC}"

test_endpoint "POST" "/api/auth/login" "Login (invalid credentials)" 401 '{"username":"test","password":"test"}'
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Test 4: Protected Endpoints
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}4. Protected Endpoints (Should Require Auth)${NC}"
echo -e "${BLUE}============================================================${NC}"

test_endpoint "GET" "/api/stats" "Statistics endpoint" 401
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

test_endpoint "GET" "/api/topics" "Topics list" 401
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

test_endpoint "GET" "/api/webhooks" "Webhooks list" 401
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

test_endpoint "GET" "/message" "Gotify messages" 401
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

test_endpoint "GET" "/application" "Gotify applications" 401
((total++)); [ $? -eq 0 ] && ((passed++)) || ((failed++))

# Test 5: Performance
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}5. Performance Tests${NC}"
echo -e "${BLUE}============================================================${NC}"

echo -e "${YELLOW}Running 10 requests to health endpoint...${NC}"

times=()
for i in {1..10}; do
    time_result=$(curl -s -w "%{time_total}" -o /dev/null "$BASE_URL/health")
    times+=($time_result)
    echo -n "."
done
echo ""

# Calculate average
total_time=0
min_time=${times[0]}
max_time=${times[0]}

for t in "${times[@]}"; do
    total_time=$(echo "$total_time + $t" | bc)
    if (( $(echo "$t < $min_time" | bc -l) )); then
        min_time=$t
    fi
    if (( $(echo "$t > $max_time" | bc -l) )); then
        max_time=$t
    fi
done

avg_time=$(echo "scale=3; $total_time / ${#times[@]}" | bc)
avg_ms=$(echo "scale=2; $avg_time * 1000" | bc)

echo ""
echo "Average response time: ${avg_ms}ms"
echo "Min: $(echo "$min_time * 1000" | bc)ms | Max: $(echo "$max_time * 1000" | bc)ms"

if (( $(echo "$avg_ms < 100" | bc -l) )); then
    echo -e "${GREEN}✓ Excellent response time: ${avg_ms}ms < 100ms${NC}"
elif (( $(echo "$avg_ms < 200" | bc -l) )); then
    echo -e "${YELLOW}ℹ Good response time: ${avg_ms}ms < 200ms${NC}"
else
    echo -e "${RED}✗ Slow response time: ${avg_ms}ms > 200ms${NC}"
fi

# Test 6: Security Headers
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}6. Security Headers Check${NC}"
echo -e "${BLUE}============================================================${NC}"

headers=$(curl -s -I "$BASE_URL/" 2>&1)

check_header() {
    local header_name=$1
    local header_value=$(echo "$headers" | grep -i "^$header_name:" | cut -d' ' -f2-)

    if [ -n "$header_value" ]; then
        echo -e "${GREEN}✓ $header_name${NC}: $header_value"
    else
        echo -e "${RED}✗ $header_name${NC}: Missing"
    fi
}

check_header "Strict-Transport-Security"
check_header "X-Content-Type-Options"
check_header "X-XSS-Protection"
check_header "Content-Security-Policy"
check_header "Referrer-Policy"

# Summary
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo "Total tests: $total"
echo -e "${GREEN}Passed: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}Failed: $failed${NC}"
else
    echo -e "${GREEN}Failed: 0${NC}"
fi
echo ""
echo "Success rate: $(echo "scale=1; $passed * 100 / $total" | bc)%"
echo ""
echo "Test completed: $(date)"
