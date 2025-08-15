#!/usr/bin/env node

/**
 * Test script to verify Regrid API integration
 * Run with: node scripts/test-regrid-api.js
 */

const REGRID_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJyZWdyaWQuY29tIiwiaWF0IjoxNzU1MDMyNDcwLCJleHAiOjE3NTc2MjQ0NzAsInUiOjU3MzgzMSwiZyI6MjMxNTMsImNhcCI6InBhOnRzOnBzOmJmOm1hOnR5OmVvOnpvOnNiIn0.rq0JXJ0FEvv8TrbDADxJ9Sieor6xjyPo54bbCOXAzsU';

async function testRegridAPI() {
  console.log('🧪 Testing Regrid API integration...\n');

  // Test area: Beverly Hills, CA (small area for testing)
  const bbox = [-118.41, 34.07, -118.39, 34.08]; // [minLng, minLat, maxLng, maxLat]
  
  try {
    console.log('📍 Testing area: Beverly Hills, CA');
    console.log('🔍 Bounding box:', bbox.join(', '));
    
    const regridUrl = new URL('https://app.regrid.com/api/v1/search.geojson');
    regridUrl.searchParams.set('token', REGRID_API_KEY);
    regridUrl.searchParams.set('limit', '10');
    regridUrl.searchParams.set('bbox', bbox.join(','));

    console.log('🌐 API URL:', regridUrl.toString().replace(REGRID_API_KEY, '[API_KEY]'));
    console.log('⏳ Fetching data...\n');

    const response = await fetch(regridUrl.toString(), {
      headers: {
        'User-Agent': 'YardQualifier/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('✅ API Response successful!');
    console.log('📊 Results:');
    console.log(`   - Type: ${data.type}`);
    console.log(`   - Features found: ${data.features?.length || 0}`);
    
    if (data.features && data.features.length > 0) {
      console.log('\n📋 Sample parcels:');
      data.features.slice(0, 3).forEach((feature, index) => {
        const props = feature.properties;
        console.log(`   ${index + 1}. APN: ${props.parcel_id || 'N/A'}`);
        console.log(`      Address: ${props.address || 'N/A'}`);
        console.log(`      Zoning: ${props.zoning || 'N/A'}`);
        console.log(`      Lot Size: ${props.lot_size_acres ? (props.lot_size_acres * 43560).toFixed(0) + ' sq ft' : 'N/A'}`);
        console.log('');
      });
    }

    // Test data structure
    if (data.features && data.features.length > 0) {
      const sampleFeature = data.features[0];
      console.log('🔍 Data structure validation:');
      console.log(`   - Has geometry: ${!!sampleFeature.geometry}`);
      console.log(`   - Geometry type: ${sampleFeature.geometry?.type || 'N/A'}`);
      console.log(`   - Has properties: ${!!sampleFeature.properties}`);
      console.log(`   - Has parcel_id: ${!!sampleFeature.properties?.parcel_id}`);
      console.log(`   - Has coordinates: ${!!sampleFeature.geometry?.coordinates}`);
    }

    console.log('\n🎉 Regrid API test completed successfully!');
    console.log('💡 You can now enable real data mode in the admin panel.');
    
  } catch (error) {
    console.error('❌ Regrid API test failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('401')) {
      console.error('   💡 This might be an authentication issue. Check your API key.');
    } else if (error.message.includes('403')) {
      console.error('   💡 This might be a permissions issue. Check your API key capabilities.');
    } else if (error.message.includes('429')) {
      console.error('   💡 Rate limit exceeded. Try again in a few minutes.');
    }
    
    process.exit(1);
  }
}

// Run the test
testRegridAPI();