#!/usr/bin/env node

/**
 * Quick test to verify the search fix works
 * Run with: node test_search_fix.js
 */

const API_BASE_URL = 'http://localhost:3000/api';

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

async function testSearchFix() {
  console.log('🧪 Testing Search Fix\n');

  try {
    // Check API health
    const healthResponse = await fetch(`${API_BASE_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error('API not responding');
    }
    console.log('✅ API is running\n');

    // Start search with default filters (should find all 8 parcels)
    console.log('🔍 Starting search with default filters...');
    const searchResponse = await fetch(`${API_BASE_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aoi: TEST_AOI,
        filters: { minRearSqft: 500 }
      })
    });

    if (!searchResponse.ok) {
      throw new Error(`Search failed: ${searchResponse.status}`);
    }

    const { searchId } = await searchResponse.json();
    console.log(`✅ Search started: ${searchId}\n`);

    // Monitor progress with timeout
    const result = await Promise.race([
      monitorProgress(searchId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 30000)
      )
    ]);

    // Analyze results
    if (result && result.results) {
      const parcelCount = result.results.length;
      console.log(`\n🎯 RESULT: Found ${parcelCount} parcels`);
      
      if (parcelCount === 8) {
        console.log('✅ SUCCESS: All expected parcels found!');
        
        // Show summary
        console.log('\nParcel Summary:');
        result.results.forEach(p => {
          console.log(`   ${p.apn}: ${p.rearFreeSqft} sq ft rear yard`);
        });
        
      } else if (parcelCount > 0) {
        console.log(`⚠️  PARTIAL: Expected 8 parcels, found ${parcelCount}`);
        console.log('   This may be expected if some parcels have rear_free_sqft < 500');
        
      } else {
        console.log('❌ FAILED: No parcels found (bug still exists)');
      }
    } else {
      console.log('❌ FAILED: No results returned');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Make sure the API server is running:');
      console.log('   cd apps/api && npm run dev');
    }
  }
}

async function monitorProgress(searchId) {
  const response = await fetch(`${API_BASE_URL}/search/${searchId}/progress`);
  
  if (!response.ok) {
    throw new Error(`Progress monitoring failed: ${response.status}`);
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
            return progress;
          }
          
          if (progress.stage === 'error') {
            throw new Error(`Search error: ${progress.error}`);
          }

        } catch (e) {
          // Skip non-JSON lines
        }
      }
    }
  }
}

// Run the test
testSearchFix().catch(console.error);