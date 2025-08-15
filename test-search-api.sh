#!/bin/bash

echo "🔍 Testing Search API Endpoint..."

# Create test search payload with the area that covers your seed data
payload='{
  "aoi": {
    "type": "Polygon", 
    "coordinates": [[
      [-118.41, 34.06],
      [-118.37, 34.06],
      [-118.37, 34.13],
      [-118.41, 34.13],
      [-118.41, 34.06]
    ]]
  },
  "filters": {
    "minRearSqft": 200
  }
}'

echo "Test area: Beverly Hills + Hollywood Hills (covers seed data)"
echo "Filter: minRearSqft = 200 (should return all parcels)"
echo ""

# Test the search endpoint
response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d "$payload" \
  http://localhost:3002/api/search)

# Extract HTTP code and body
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

echo "HTTP Status: $http_code"
echo ""

if [ "$http_code" = "200" ]; then
    echo "✅ Search API working!"
    echo ""
    echo "Results:"
    echo "$body" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'results' in data:
        results = data['results']
        print(f'Found {len(results)} parcels:')
        for i, parcel in enumerate(results):
            print(f'  {i+1}. {parcel[\"apn\"]} - {parcel[\"address\"]}')
            if 'rearFreeSqft' in parcel:
                print(f'     Rear yard: {parcel[\"rearFreeSqft\"]} sq ft')
    else:
        print('Response structure:', json.dumps(data, indent=2)[:500])
except:
    print('Raw response:', repr(sys.stdin.read()[:500]))
" 2>/dev/null || echo "$body"

elif [ "$http_code" = "400" ]; then
    echo "❌ Bad Request - Check API payload format"
    echo "$body"
elif [ "$http_code" = "500" ]; then
    echo "❌ Server Error - Check server logs"  
    echo "$body"
else
    echo "❌ Unexpected status: $http_code"
    echo "$body"
fi