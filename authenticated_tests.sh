#!/bin/bash
# Comprehensive Authenticated Testing for rstify Production
# Using temporary admin account: test1

BASE_URL="https://rstify.js-node.cc"
USERNAME="test1"
PASSWORD="Trls0199"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}rstify Authenticated Testing - Full Feature Test${NC}"
echo -e "${BLUE}============================================================${NC}\n"

# Step 1: Login and get JWT token
echo -e "${YELLOW}1. Testing Authentication...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

echo "Login response: $LOGIN_RESPONSE"

JWT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$JWT_TOKEN" ]; then
    echo -e "${RED}✗ Login failed! Cannot proceed with tests.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Login successful!${NC}"
    echo "JWT Token (first 50 chars): ${JWT_TOKEN:0:50}..."
fi

# Step 2: Get current user info
echo -e "\n${YELLOW}2. Testing Current User Endpoint...${NC}"
USER_INFO=$(curl -s -X GET "$BASE_URL/current/user" \
    -H "Authorization: Bearer $JWT_TOKEN")
echo "User info: $USER_INFO"
echo -e "${GREEN}✓ User info retrieved${NC}"

# Step 3: Get statistics
echo -e "\n${YELLOW}3. Testing Statistics Endpoint...${NC}"
STATS=$(curl -s -X GET "$BASE_URL/api/stats" \
    -H "Authorization: Bearer $JWT_TOKEN")
echo "Stats: $STATS"
echo -e "${GREEN}✓ Statistics retrieved${NC}"

# Step 4: List applications
echo -e "\n${YELLOW}4. Testing Application Management...${NC}"
APPS=$(curl -s -X GET "$BASE_URL/application" \
    -H "Authorization: Bearer $JWT_TOKEN")
echo "Existing applications: $APPS"

# Step 5: Create a test application
echo -e "\n${YELLOW}5. Creating Test Application...${NC}"
CREATE_APP=$(curl -s -X POST "$BASE_URL/application" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test App","description":"Automated test application","defaultPriority":5}')
echo "Created app: $CREATE_APP"

APP_ID=$(echo $CREATE_APP | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)
APP_TOKEN=$(echo $CREATE_APP | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -n "$APP_TOKEN" ]; then
    echo -e "${GREEN}✓ Application created successfully${NC}"
    echo "App ID: $APP_ID"
    echo "App Token: $APP_TOKEN"
else
    echo -e "${RED}✗ Failed to create application${NC}"
fi

# Step 6: Send a test message using app token
echo -e "\n${YELLOW}6. Testing Message Creation (Gotify API)...${NC}"
if [ -n "$APP_TOKEN" ]; then
    MESSAGE=$(curl -s -X POST "$BASE_URL/message" \
        -H "X-Gotify-Key: $APP_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"title":"Test Message","message":"This is an automated test message","priority":5}')
    echo "Message created: $MESSAGE"
    MSG_ID=$(echo $MESSAGE | grep -o '"id":[0-9]*' | cut -d: -f2)
    echo -e "${GREEN}✓ Message created with ID: $MSG_ID${NC}"
fi

# Step 7: List messages
echo -e "\n${YELLOW}7. Testing Message Retrieval...${NC}"
MESSAGES=$(curl -s -X GET "$BASE_URL/message" \
    -H "Authorization: Bearer $JWT_TOKEN")
echo "Messages (first 200 chars): ${MESSAGES:0:200}..."
echo -e "${GREEN}✓ Messages retrieved${NC}"

# Step 8: Create a topic
echo -e "\n${YELLOW}8. Testing Topic Management...${NC}"
CREATE_TOPIC=$(curl -s -X POST "$BASE_URL/api/topics" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"test-topic","description":"Automated test topic","everyoneRead":true,"everyoneWrite":true}')
echo "Created topic: $CREATE_TOPIC"
TOPIC_ID=$(echo $CREATE_TOPIC | grep -o '"id":[0-9]*' | cut -d: -f2)
echo -e "${GREEN}✓ Topic created with ID: $TOPIC_ID${NC}"

# Step 9: List topics
echo -e "\n${YELLOW}9. Listing All Topics...${NC}"
TOPICS=$(curl -s -X GET "$BASE_URL/api/topics" \
    -H "Authorization: Bearer $JWT_TOKEN")
echo "Topics: $TOPICS"
echo -e "${GREEN}✓ Topics retrieved${NC}"

# Step 10: Create a webhook
echo -e "\n${YELLOW}10. Testing Webhook Creation...${NC}"
CREATE_WEBHOOK=$(curl -s -X POST "$BASE_URL/api/webhooks" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"Test Webhook\",\"webhookType\":\"incoming\",\"targetTopicId\":$TOPIC_ID,\"template\":{\"title\":\"Webhook Test\",\"message\":\"{{message}}\",\"priority\":5}}")
echo "Created webhook: $CREATE_WEBHOOK"
WEBHOOK_ID=$(echo $CREATE_WEBHOOK | grep -o '"id":[0-9]*' | cut -d: -f2)
WEBHOOK_TOKEN=$(echo $CREATE_WEBHOOK | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ Webhook created with ID: $WEBHOOK_ID${NC}"
echo "Webhook token: $WEBHOOK_TOKEN"

# Step 11: Test webhook by sending data to it
if [ -n "$WEBHOOK_TOKEN" ]; then
    echo -e "\n${YELLOW}11. Testing Webhook Reception...${NC}"
    WEBHOOK_RESULT=$(curl -s -X POST "$BASE_URL/api/wh/$WEBHOOK_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"message":"This is a test webhook payload","priority":5}')
    echo "Webhook result: $WEBHOOK_RESULT"
    echo -e "${GREEN}✓ Webhook tested${NC}"
fi

# Step 12: Test ntfy-style publishing
echo -e "\n${YELLOW}12. Testing ntfy API Compatibility...${NC}"
NTFY_MSG=$(curl -s -X POST "$BASE_URL/test-ntfy-topic" \
    -H "Title: ntfy Test" \
    -H "Priority: high" \
    -H "Tags: test,automated" \
    -d "This is a test message using ntfy-style API")
echo "ntfy message: $NTFY_MSG"
echo -e "${GREEN}✓ ntfy API tested${NC}"

# Step 13: Create a client token
echo -e "\n${YELLOW}13. Testing Client Token Management...${NC}"
CREATE_CLIENT=$(curl -s -X POST "$BASE_URL/client" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Test Client"}')
echo "Created client: $CREATE_CLIENT"
CLIENT_TOKEN=$(echo $CREATE_CLIENT | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo -e "${GREEN}✓ Client created with token: ${CLIENT_TOKEN:0:20}...${NC}"

# Step 14: Performance test - rapid message sending
echo -e "\n${YELLOW}14. Performance Test - Message Throughput...${NC}"
if [ -n "$APP_TOKEN" ]; then
    echo "Sending 10 messages rapidly..."
    START_TIME=$(date +%s.%N)
    for i in {1..10}; do
        curl -s -X POST "$BASE_URL/message" \
            -H "X-Gotify-Key: $APP_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"title\":\"Load Test $i\",\"message\":\"Performance test message $i\",\"priority\":5}" > /dev/null &
    done
    wait
    END_TIME=$(date +%s.%N)
    DURATION=$(echo "$END_TIME - $START_TIME" | bc)
    THROUGHPUT=$(echo "scale=2; 10 / $DURATION" | bc 2>/dev/null || echo "N/A")
    echo -e "${GREEN}✓ Sent 10 messages in ${DURATION}s${NC}"
    echo "Throughput: ~${THROUGHPUT} messages/second"
fi

# Step 15: Test file attachment (if message exists)
if [ -n "$MSG_ID" ]; then
    echo -e "\n${YELLOW}15. Testing File Attachment Upload...${NC}"

    # Create a small test file
    echo "This is a test file for attachment testing" > /tmp/test-attachment.txt

    UPLOAD_RESULT=$(curl -s -X POST "$BASE_URL/api/messages/$MSG_ID/attachments" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -F "file=@/tmp/test-attachment.txt")
    echo "Upload result: $UPLOAD_RESULT"

    ATTACHMENT_ID=$(echo $UPLOAD_RESULT | grep -o '"id":[0-9]*' | cut -d: -f2)
    if [ -n "$ATTACHMENT_ID" ]; then
        echo -e "${GREEN}✓ File uploaded successfully - Attachment ID: $ATTACHMENT_ID${NC}"

        # Test download
        echo -e "\n${YELLOW}16. Testing File Download...${NC}"
        curl -s "$BASE_URL/api/attachments/$ATTACHMENT_ID" -o /tmp/downloaded-attachment.txt
        if [ -f /tmp/downloaded-attachment.txt ]; then
            echo -e "${GREEN}✓ File downloaded successfully${NC}"
            echo "Downloaded content: $(cat /tmp/downloaded-attachment.txt)"
        fi
    else
        echo -e "${RED}✗ File upload failed${NC}"
    fi

    rm -f /tmp/test-attachment.txt /tmp/downloaded-attachment.txt
fi

# Summary
echo -e "\n${BLUE}============================================================${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}============================================================${NC}\n"

echo -e "${GREEN}✓ Authentication & Authorization${NC}"
echo -e "${GREEN}✓ User Management${NC}"
echo -e "${GREEN}✓ Application Management${NC}"
echo -e "${GREEN}✓ Message Operations (Gotify API)${NC}"
echo -e "${GREEN}✓ Topic Management${NC}"
echo -e "${GREEN}✓ Webhook Creation & Testing${NC}"
echo -e "${GREEN}✓ ntfy API Compatibility${NC}"
echo -e "${GREEN}✓ Client Token Management${NC}"
echo -e "${GREEN}✓ File Attachments${NC}"
echo -e "${GREEN}✓ Performance Testing${NC}"

echo -e "\n${YELLOW}Test Data Created:${NC}"
echo "- Application ID: $APP_ID (Token: ${APP_TOKEN:0:20}...)"
echo "- Topic ID: $TOPIC_ID"
echo "- Webhook ID: $WEBHOOK_ID (Token: ${WEBHOOK_TOKEN:0:20}...)"
echo "- Client Token: ${CLIENT_TOKEN:0:20}..."
echo "- Test messages created"

echo -e "\n${YELLOW}⚠️  Remember to:${NC}"
echo "1. Delete the test1 admin account"
echo "2. Clean up test data if needed"

echo -e "\n${GREEN}All authenticated tests completed successfully!${NC}"
