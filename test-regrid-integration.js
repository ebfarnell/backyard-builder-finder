#!/usr/bin/env node

/**
 * Test script to verify Regrid API integration
 * This tests the enhanced search service that automatically fetches from Regrid
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3001/api';

// Test areas outside the existing 8 seed parcels
const testAreas = {
  // Culver City area (should have many parcels)
  culverCity: {
    type: "Polygon",
    coordinates: [[
      [-118.4100, 34.0100],
      [-118.3900, 34.0100], 
      [-118.3900, 34.0300],
      [-118.4100, 34.0300],
      [-118.4100, 34.0100]
    ]]
  },
  
  // Brentwood area (should have many parcels)
  brentwood: {
    type: "Polygon", 
    coordinates: [[
      [-118.4700, 34.0500],
      [-118.4500, 34.0500],
      [-118.4500, 34.0700], 
      [-118.4700, 34.0700],
      [-118.4700, 34.0500]
    ]]
  }
};

async function testRegridDirectFetch() {
  console.log('\\n🔍 Testing direct Regrid API fetch...');
  
  try {
    const bbox = [-118.41, 34.01, -118.39, 34.03]; // Culver City bbox
    
    const response = await fetch(`${API_BASE}/regrid/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox })
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Direct Regrid fetch failed:', error);
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Direct Regrid fetch successful: ${data.features?.length || 0} parcels`);
    return true;
    
  } catch (error) {
    console.error('❌ Direct Regrid fetch error:', error.message);
    return false;
  }
}

async function testEnhancedSearch(areaName, aoi) {
  console.log(`\\n🔍 Testing enhanced search for ${areaName}...`);
  
  try {
    // Start search
    const searchResponse = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aoi: aoi,
        filters: {
          minRearSqft: 500,
          lotSizeMin: 3000
        }
      })
    });
    
    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error(`❌ Search failed for ${areaName}:`, error);
      return false;
    }
    
    const { searchId } = await searchResponse.json();
    console.log(`📝 Search started: ${searchId}`);
    
    // Monitor progress
    return new Promise((resolve) => {
      const eventSource = new (require('eventsource'))(`${API_BASE}/search/${searchId}/progress`);
      
      let timeout = setTimeout(() => {
        eventSource.close();
        console.error(`❌ Search timeout for ${areaName}`);
        resolve(false);
      }, 60000); // 60 second timeout
      
      eventSource.onmessage = function(event) {
        try {
          const progress = JSON.parse(event.data);
          console.log(`📊 ${areaName}: ${progress.stage} - ${progress.message}`);
          
          if (progress.stage === 'complete') {
            clearTimeout(timeout);
            eventSource.close();
            
            const resultCount = progress.results?.length || 0;
            console.log(`✅ ${areaName} search complete: ${resultCount} parcels found`);
            
            if (resultCount > 0) {
              console.log(`🏠 Sample parcel: ${progress.results[0]?.address || 'No address'} (${progress.results[0]?.lotArea} sq ft)`);
            }
            
            resolve(resultCount > 0);
          } else if (progress.stage === 'error') {
            clearTimeout(timeout);
            eventSource.close();
            console.error(`❌ ${areaName} search error:`, progress.error);
            resolve(false);
          }
        } catch (error) {
          console.error(`❌ Error parsing progress for ${areaName}:`, error.message);
        }
      };
      
      eventSource.onerror = function(error) {
        clearTimeout(timeout);
        eventSource.close();
        console.error(`❌ EventSource error for ${areaName}:`, error);
        resolve(false);
      };
    });
    
  } catch (error) {
    console.error(`❌ Search error for ${areaName}:`, error.message);
    return false;
  }
}

async function testRegridCache() {
  console.log('\\n🗄️ Testing Regrid cache...');
  
  try {
    const response = await fetch(`${API_BASE}/regrid/cache`);
    
    if (!response.ok) {
      console.error('❌ Cache fetch failed');
      return false;
    }
    
    const data = await response.json();
    console.log(`✅ Cache entries: ${data.count}`);
    
    if (data.entries?.length > 0) {
      console.log(`📅 Latest entry: ${data.entries[0].cache_key} (${data.entries[0].created_at})`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Cache test error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Regrid Integration Tests\\n');
  console.log('This will test if the enhanced search service automatically fetches');
  console.log('real parcels from Regrid API when searching new areas.\\n');
  
  // Test 1: Direct Regrid API fetch
  const directFetchWorking = await testRegridDirectFetch();
  
  if (!directFetchWorking) {
    console.log('\\n❌ Direct Regrid fetch failed. Check:');
    console.log('   - REGRID_API_KEY is set in .env');
    console.log('   - API server is running on port 3001');
    console.log('   - Network connectivity to Regrid API');
    return;
  }
  
  // Test 2: Enhanced search with automatic Regrid fetching
  console.log('\\n🔄 Testing enhanced search with automatic Regrid fetching...');
  
  const culverCityResults = await testEnhancedSearch('Culver City', testAreas.culverCity);
  const brentwoodResults = await testEnhancedSearch('Brentwood', testAreas.brentwood);
  
  // Test 3: Check cache
  await testRegridCache();
  
  // Summary
  console.log('\\n📋 Test Summary:');
  console.log(`   Direct Regrid fetch: ${directFetchWorking ? '✅' : '❌'}`);
  console.log(`   Culver City search: ${culverCityResults ? '✅' : '❌'}`);
  console.log(`   Brentwood search: ${brentwoodResults ? '✅' : '❌'}`);
  
  if (directFetchWorking && (culverCityResults || brentwoodResults)) {
    console.log('\\n🎉 SUCCESS: Enhanced search is fetching real Regrid data!');
    console.log('Users can now search any area and get real property data.');
  } else {
    console.log('\\n⚠️  ISSUE: Enhanced search may not be working correctly.');
    console.log('Check the API logs for more details.');
  }
}

// Check if eventsource is available
try {
  require('eventsource');
} catch (error) {
  console.error('❌ Missing dependency: eventsource');
  console.log('Install with: npm install eventsource');
  process.exit(1);
}

runTests().catch(error => {
  console.error('❌ Test runner error:', error);
  process.exit(1);
});