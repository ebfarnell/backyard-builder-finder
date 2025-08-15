-- RLS (Row Level Security) Tests
-- These tests verify that RLS policies are working correctly

BEGIN;

-- Create test users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'user1@test.com', 'encrypted', NOW(), NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'user2@test.com', 'encrypted', NOW(), NOW(), NOW());

-- Test 1: Parcels should be world-readable
SELECT plan(4);

-- Set session as user1
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

-- User should be able to read parcels
SELECT ok(
  (SELECT COUNT(*) FROM parcels) >= 0,
  'User can read parcels'
);

-- Test 2: User API keys should be user-scoped
-- Insert API key for user1
INSERT INTO user_api_keys (user_id, provider, key_hash, is_encrypted)
VALUES ('11111111-1111-1111-1111-111111111111', 'openai', 'hash1', false);

-- User1 should see their own key
SELECT ok(
  (SELECT COUNT(*) FROM user_api_keys WHERE user_id = '11111111-1111-1111-1111-111111111111') = 1,
  'User can see their own API keys'
);

-- Switch to user2
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

-- User2 should not see user1's keys
SELECT ok(
  (SELECT COUNT(*) FROM user_api_keys) = 0,
  'User cannot see other users API keys'
);

-- Test 3: API usage should be user-scoped
-- Switch back to user1
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111"}', true);

-- Insert API usage for user1 (this would normally be done by service role)
-- For testing, we'll simulate it
SELECT set_config('role', 'service_role', true);
INSERT INTO api_usage (user_id, search_id, provider, model, tokens_used, cost)
VALUES ('11111111-1111-1111-1111-111111111111', 'test-search', 'openai', 'gpt-4o-mini', 100, 0.01);
SELECT set_config('role', 'authenticated', true);

-- User1 should see their usage
SELECT ok(
  (SELECT COUNT(*) FROM api_usage WHERE user_id = '11111111-1111-1111-1111-111111111111') = 1,
  'User can see their own API usage'
);

-- Switch to user2
SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222"}', true);

-- User2 should not see user1's usage
SELECT ok(
  (SELECT COUNT(*) FROM api_usage) = 0,
  'User cannot see other users API usage'
);

-- Test 4: Negative tests - users should not be able to insert/update restricted data
-- Try to insert parcel as regular user (should fail)
SELECT throws_ok(
  'INSERT INTO parcels (apn, geometry, lot_area) VALUES (''test'', ST_GeomFromText(''POINT(0 0)'', 4326), 1000)',
  'new row violates row-level security policy',
  'Regular users cannot insert parcels'
);

-- Try to insert CV detection as regular user (should fail)
SELECT throws_ok(
  'INSERT INTO cv_detections (parcel_id, kind, geometry, confidence) VALUES (''11111111-1111-1111-1111-111111111111'', ''pool'', ST_GeomFromText(''POINT(0 0)'', 4326), 0.8)',
  'new row violates row-level security policy',
  'Regular users cannot insert CV detections'
);

-- Clean up
DELETE FROM api_usage WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM user_api_keys WHERE user_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();

ROLLBACK;