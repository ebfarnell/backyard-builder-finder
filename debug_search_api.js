#!/usr/bin/env node

/**
 * Debug script to test the search API and identify issues
 * Run with: node debug_search_api.js
 */

const API_BASE_URL = 'http://localhost:3000/api';

// Test AOI that should include all seed parcels
const TEST_AOI = {
  type: 'Polygon',
  coordinates: [[
    [-118.51, 34.01],
    [-118.37, 34.01],
    [-118.37, 34.13],
    [-118.51, 34.13],
    [-118.51, 34.01]
  ]]
};

async function debugSearch() {
  console.log('🔍 Testing Search API Debug\n');

  // Test 1: Basic search with default filters
  console.log('Test 1: Basic search with default minRearSqft (500)');
  await testSearch({
    aoi: TEST_AOI,
    filters: {
      minRearSqft: 500
    }
  });

  // Test 2: Search with lower minRearSqft threshold
  console.log('\nTest 2: Search with lower minRearSqft (100)');
  await testSearch({
    aoi: TEST_AOI,
    filters: {
      minRearSqft: 100
    }
  });

  // Test 3: Search with higher minRearSqft threshold
  console.log('\nTest 3: Search with higher minRearSqft (2000)');
  await testSearch({
    aoi: TEST_AOI,
    filters: {
      minRearSqft: 2000
    }
  });

  // Test 4: Search with additional filters
  console.log('\nTest 4: Search with lot size filter');
  await testSearch({
    aoi: TEST_AOI,
    filters: {
      minRearSqft: 500,
      lotSizeMin: 7000
    }
  });

  // Test 5: Search with pool filter
  console.log('\nTest 5: Search with pool requirement');
  await testSearch({
    aoi: TEST_AOI,
    filters: {
      minRearSqft: 500,
      hasPool: true
    }
  });
}

async function testSearch(searchRequest) {
  try {
    // Start search
    const response = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchRequest)
    });

    if (!response.ok) {
      console.error(`❌ Search failed: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error('Error details:', error);
      return;
    }

    const { searchId } = await response.json();
    console.log(`✅ Search started: ${searchId}`);

    // Monitor progress
    await monitorSearchProgress(searchId);

  } catch (error) {
    console.error('❌ Search error:', error.message);
  }
}

async function monitorSearchProgress(searchId) {
  try {
    const response = await fetch(`${API_BASE_URL}/search/${searchId}/progress`);
    
    if (!response.ok) {
      console.error(`❌ Progress monitoring failed: ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const progress = JSON.parse(line.substring(6));
            console.log(`📊 ${progress.stage}: ${progress.message}`);
            
            if (progress.stage === 'complete') {
              console.log(`🎯 Results: ${progress.results?.length || 0} parcels found`);
              
              if (progress.results && progress.results.length > 0) {
                console.log('Sample results:');
                progress.results.slice(0, 3).forEach(parcel => {
                  console.log(`   - ${parcel.apn}: ${parcel.address}, ${parcel.rearFreeSqft} sq ft rear yard, qualifies: ${parcel.qualifies}`);
                });
              }
              return;
            }
            
            if (progress.stage === 'error') {
              console.error(`❌ Search error: ${progress.error}`);
              return;
            }

            if (progress.stage === 'sql_filter') {
              console.log(`   SQL Filter found ${progress.processed} parcels`);
            }

          } catch (e) {
            // Skip non-JSON lines (keepalive, etc.)
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Progress monitoring error:', error.message);
  }
}

// Test individual components
async function testDatabaseDirect() {
  console.log('\n🗄️  Testing Database Direct Access');
  
  try {
    // This would require setting up a direct database connection
    // For now, we'll rely on the API tests above
    console.log('   (Database direct testing requires Supabase client setup)');
    
  } catch (error) {
    console.error('❌ Database test error:', error.message);
  }
}

// Main execution
async function main() {
  console.log('Starting search debugging...\n');
  
  // Check if API is running
  try {
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ API is running\n');
    } else {
      console.error('❌ API health check failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Cannot connect to API. Make sure the server is running on port 3000');
    console.error('   Run: cd apps/api && npm run dev');
    process.exit(1);
  }

  await debugSearch();
  await testDatabaseDirect();
  
  console.log('\n🏁 Debug complete');
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { debugSearch, testSearch, monitorSearchProgress };