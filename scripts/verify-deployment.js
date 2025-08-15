#!/usr/bin/env node

/**
 * Post-deployment verification script
 * Tests that real data integration is working
 */

const API_BASE = process.env.API_URL || 'https://yard-qualifier-api.onrender.com';

async function verifyDeployment() {
  console.log('🔍 Verifying deployment and real data integration...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing API health...');
    const healthResponse = await fetch(`${API_BASE}/api/health`);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    const health = await healthResponse.json();
    console.log('   ✅ API is healthy:', health.status);

    // Test 2: Data status
    console.log('\n2️⃣ Checking data configuration...');
    const statusResponse = await fetch(`${API_BASE}/api/admin/data-status`);
    if (!statusResponse.ok) {
      throw new Error(`Data status check failed: ${statusResponse.status}`);
    }
    const status = await statusResponse.json();
    console.log('   📊 Total parcels:', status.totalParcels);
    console.log('   🔧 API config valid:', status.configuration.valid);
    console.log('   📁 Data source:', status.dataSource);
    
    if (!status.configuration.valid) {
      console.log('   ⚠️  Missing config:', status.configuration.missing.join(', '));
    }

    // Test 3: Real data fetch (small area)
    console.log('\n3️⃣ Testing real data fetch...');
    const testAOI = {
      type: 'Polygon',
      coordinates: [[
        [-118.41, 34.07],
        [-118.40, 34.07],
        [-118.40, 34.08],
        [-118.41, 34.08],
        [-118.41, 34.07]
      ]]
    };

    const fetchResponse = await fetch(`${API_BASE}/api/admin/fetch-area-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aoi: testAOI,
        maxParcels: 10
      })
    });

    if (fetchResponse.ok) {
      const fetchResult = await fetchResponse.json();
      console.log('   ✅ Real data fetch successful');
      console.log('   📍 Parcels in test area:', fetchResult.parcelsInArea);
    } else {
      const error = await fetchResponse.json();
      console.log('   ⚠️  Real data fetch failed:', error.error);
      if (error.missing) {
        console.log('   🔑 Missing keys:', error.missing.join(', '));
      }
    }

    console.log('\n🎉 Deployment verification complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Visit the admin panel to enable real data mode');
    console.log('   2. Test a search in Beverly Hills, CA area');
    console.log('   3. Monitor logs for real data fetching');
    console.log('   4. Check that results show real addresses and APNs');

  } catch (error) {
    console.error('\n❌ Deployment verification failed:');
    console.error('   Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check that all services are deployed and running');
    console.error('   2. Verify environment variables are set correctly');
    console.error('   3. Check Render logs for detailed error messages');
    process.exit(1);
  }
}

// Run verification
verifyDeployment();