#!/usr/bin/env node

// Quick test to verify Supabase connection works
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.log('Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔍 Testing Supabase connection...');
  console.log(`Project URL: ${supabaseUrl}`);
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('parcels')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    // Test seed data exists
    const { data: parcels, error: parcelError } = await supabase
      .from('parcels')
      .select('apn, address')
      .limit(5);
    
    if (parcelError) {
      console.error('❌ Failed to query parcels:', parcelError.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log(`📊 Found ${parcels?.length || 0} parcels in database`);
    
    if (parcels && parcels.length > 0) {
      console.log('Sample parcels:');
      parcels.forEach(p => console.log(`  - ${p.apn}: ${p.address}`));
    } else {
      console.log('⚠️  No seed data found - you may need to run migrations');
    }
    
    return true;
    
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    return false;
  }
}

testConnection()
  .then(success => {
    if (success) {
      console.log('\n✅ Your existing Supabase project is working correctly!');
      console.log('No need to create a new project.');
    } else {
      console.log('\n❌ Connection issues detected.');
      console.log('Check if the Supabase project is still active.');
    }
  })
  .catch(err => {
    console.error('Test script error:', err);
  });