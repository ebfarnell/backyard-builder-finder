#!/bin/bash

# Simple Supabase connection test using curl
source .env

echo "🔍 Testing Supabase connection..."
echo "Project URL: $VITE_SUPABASE_URL"

if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
    echo "❌ Missing Supabase credentials in .env file"
    echo "Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
    exit 1
fi

# Test basic connection
echo ""
echo "Testing basic connection..."
response=$(curl -s -w "%{http_code}" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  "$VITE_SUPABASE_URL/rest/v1/parcels?select=apn,address&limit=5")

http_code="${response: -3}"
body="${response%???}"

echo "HTTP Status: $http_code"

if [ "$http_code" = "200" ]; then
    echo "✅ Supabase connection successful!"
    echo ""
    echo "Sample data:"
    echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
elif [ "$http_code" = "404" ]; then
    echo "⚠️  Connection works but 'parcels' table not found"
    echo "You may need to run migrations"
elif [ "$http_code" = "401" ]; then
    echo "❌ Authentication failed - check your API keys"
else
    echo "❌ Connection failed with status $http_code"
    echo "Response: $body"
fi