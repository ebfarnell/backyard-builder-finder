"""Seed development data

Revision ID: 002
Revises: 001
Create Date: 2025-01-14 12:01:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert default development organization
    op.execute("""
        INSERT INTO organizations (id, name, plan_tier, limits_jsonb, created_at)
        VALUES (
            'a0000000-0000-4000-8000-000000000001'::UUID,
            'Development Organization',
            'pro',
            '{
                "monthly_searches": 100,
                "concurrent_searches": 5,
                "max_parcels_per_search": 1000,
                "cv_operations_per_month": 500,
                "llm_tokens_per_month": 100000
            }'::jsonb,
            NOW()
        )
    """)

    # Insert default development user
    op.execute("""
        INSERT INTO users (id, org_id, email, name, sso_provider, role, is_active, created_at)
        VALUES (
            'b0000000-0000-4000-8000-000000000001'::UUID,
            'a0000000-0000-4000-8000-000000000001'::UUID,
            'dev@backyard-builder-finder.com',
            'Development User',
            'email',
            'admin',
            true,
            NOW()
        )
    """)

    # Insert demo LA search area for development
    op.execute("""
        INSERT INTO searches (
            id, org_id, user_id, name, area_geom, area_name,
            filters_jsonb, options_jsonb, status, created_at
        )
        VALUES (
            'c0000000-0000-4000-8000-000000000001'::UUID,
            'a0000000-0000-4000-8000-000000000001'::UUID,
            'b0000000-0000-4000-8000-000000000001'::UUID,
            'LA Demo - 1200 sqft, no pool',
            ST_GeogFromText('POLYGON((-118.5 33.9, -118.1 33.9, -118.1 34.3, -118.5 34.3, -118.5 33.9))'),
            'Los Angeles, CA',
            '{
                "unit": {
                    "area_sqft": 1200,
                    "rotation_allowed": true
                },
                "setbacks": {
                    "front": 25,
                    "rear": 15,
                    "side": 10
                },
                "hoa_preference": "exclude",
                "pool_preference": "exclude",
                "trees_block_building": true,
                "exclude_flood_zones": true,
                "listing_status": "for_sale_only",
                "min_lot_sqft": 5000
            }'::jsonb,
            '{
                "preview_only": false,
                "max_parcels": 1000,
                "enable_cv": false,
                "enable_llm": true
            }'::jsonb,
            'draft',
            NOW()
        )
    """)

    # Create development view for easy access
    op.execute("""
        CREATE OR REPLACE VIEW dev_summary AS
        SELECT 
            'Organizations' AS table_name,
            COUNT(*) AS row_count
        FROM organizations
        UNION ALL
        SELECT 'Users', COUNT(*) FROM users
        UNION ALL
        SELECT 'Searches', COUNT(*) FROM searches
        UNION ALL
        SELECT 'Parcels', COUNT(*) FROM parcels
        UNION ALL
        SELECT 'Footprints', COUNT(*) FROM footprints
        UNION ALL
        SELECT 'Listings', COUNT(*) FROM listings
        ORDER BY table_name;
    """)


def downgrade() -> None:
    # Drop development view
    op.execute("DROP VIEW IF EXISTS dev_summary")

    # Delete seed data (in reverse order due to foreign keys)
    op.execute("DELETE FROM searches WHERE id = 'c0000000-0000-4000-8000-000000000001'::UUID")
    op.execute("DELETE FROM users WHERE id = 'b0000000-0000-4000-8000-000000000001'::UUID")
    op.execute("DELETE FROM organizations WHERE id = 'a0000000-0000-4000-8000-000000000001'::UUID")