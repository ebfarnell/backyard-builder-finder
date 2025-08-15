-- Simple seed data for Los Angeles County pilot

-- Insert sample parcels in LA County
INSERT INTO parcels (apn, address, geometry, lot_area, zoning_code, last_sale_price, last_sale_date, hoa_status) VALUES
-- Beverly Hills area parcels
('4333-001-001', '123 Beverly Dr, Beverly Hills, CA 90210', 
 ST_GeomFromText('POLYGON((-118.4001 34.0701, -118.3999 34.0701, -118.3999 34.0699, -118.4001 34.0699, -118.4001 34.0701))', 4326),
 8500, 'R1', 2500000, '2023-06-15', 'yes'),

('4333-001-002', '125 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3999 34.0701, -118.3997 34.0701, -118.3997 34.0699, -118.3999 34.0699, -118.3999 34.0701))', 4326),
 7200, 'R1', 2200000, '2023-08-22', 'yes'),

('4333-001-003', '127 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3997 34.0701, -118.3995 34.0701, -118.3995 34.0699, -118.3997 34.0699, -118.3997 34.0701))', 4326),
 6800, 'R1', 1950000, '2022-12-10', 'yes'),

('4333-001-004', '129 Beverly Dr, Beverly Hills, CA 90210',
 ST_GeomFromText('POLYGON((-118.3995 34.0701, -118.3993 34.0701, -118.3993 34.0699, -118.3995 34.0699, -118.3995 34.0701))', 4326),
 9200, 'R1', 2800000, '2023-03-18', 'yes'),

-- Santa Monica area parcels
('4293-001-001', '456 Ocean Ave, Santa Monica, CA 90401',
 ST_GeomFromText('POLYGON((-118.4951 34.0195, -118.4949 34.0195, -118.4949 34.0193, -118.4951 34.0193, -118.4951 34.0195))', 4326),
 5500, 'R2', 1800000, '2023-09-05', 'no'),

('4293-001-002', '458 Ocean Ave, Santa Monica, CA 90401',
 ST_GeomFromText('POLYGON((-118.4949 34.0195, -118.4947 34.0195, -118.4947 34.0193, -118.4949 34.0193, -118.4949 34.0195))', 4326),
 4800, 'R2', 1650000, '2023-07-12', 'no'),

-- Hollywood Hills parcels
('5554-001-001', '789 Mulholland Dr, Los Angeles, CA 90046',
 ST_GeomFromText('POLYGON((-118.3751 34.1201, -118.3749 34.1201, -118.3749 34.1199, -118.3751 34.1199, -118.3751 34.1201))', 4326),
 12000, 'R1', 3200000, '2023-04-28', 'unknown'),

('5554-001-002', '791 Mulholland Dr, Los Angeles, CA 90046',
 ST_GeomFromText('POLYGON((-118.3749 34.1201, -118.3747 34.1201, -118.3747 34.1199, -118.3749 34.1199, -118.3749 34.1201))', 4326),
 10500, 'R1', 2900000, '2022-11-15', 'unknown');

-- Update parcels with pool information
UPDATE parcels SET has_pool = true WHERE apn IN ('4333-001-001', '4333-001-004', '5554-001-001', '5554-001-002');
UPDATE parcels SET has_pool = false WHERE has_pool IS NULL;

-- Set some basic rear yard areas manually for testing
UPDATE parcels SET rear_free_sqft = 1200 WHERE apn IN ('4333-001-001', '4333-001-004');
UPDATE parcels SET rear_free_sqft = 800 WHERE apn IN ('5554-001-001', '5554-001-002');
UPDATE parcels SET rear_free_sqft = 400 WHERE apn IN ('4333-001-002', '4333-001-003');
UPDATE parcels SET rear_free_sqft = 300 WHERE apn IN ('4293-001-001', '4293-001-002');

-- Set qualification status
UPDATE parcels SET qualifies = true WHERE rear_free_sqft >= 1000;
UPDATE parcels SET qualifies = false WHERE rear_free_sqft < 500;
UPDATE parcels SET qualifies = null WHERE rear_free_sqft >= 500 AND rear_free_sqft < 1000;

-- Add rationale
UPDATE parcels SET rationale = 'Meets minimum rear yard requirement with adequate space' WHERE qualifies = true;
UPDATE parcels SET rationale = 'Insufficient rear yard space for requirements' WHERE qualifies = false;