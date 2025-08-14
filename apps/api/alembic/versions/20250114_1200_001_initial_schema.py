"""Initial schema with PostGIS and RLS

Revision ID: 001
Revises: 
Create Date: 2025-01-14 12:00:00.000000

"""
from typing import Sequence, Union

import geoalchemy2
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis_topology")
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gin")

    # Create custom enums
    op.execute("CREATE TYPE plan_tier AS ENUM ('free', 'pro', 'enterprise')")
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer')")
    op.execute("CREATE TYPE sso_provider AS ENUM ('google', 'microsoft', 'email')")
    op.execute("CREATE TYPE api_provider AS ENUM ('openai', 'anthropic', 'mapbox', 'google_maps', 'esri')")
    op.execute("CREATE TYPE footprint_type AS ENUM ('main', 'outbuilding', 'driveway', 'pool', 'other')")
    op.execute("CREATE TYPE listing_status AS ENUM ('active', 'pending', 'sold', 'off_market')")
    op.execute("CREATE TYPE export_type AS ENUM ('csv', 'geojson', 'pdf')")
    op.execute("CREATE TYPE export_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'expired')")
    op.execute("CREATE TYPE cv_artifact_type AS ENUM ('pool', 'tree_canopy', 'driveway', 'shed', 'other')")
    op.execute("CREATE TYPE search_status AS ENUM ('draft', 'queued', 'running', 'completed', 'failed', 'cancelled')")

    # Create utility function for updating timestamps
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # Organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("plan_tier", sa.Enum("free", "pro", "enterprise", name="plan_tier"), nullable=False),
        sa.Column("limits_jsonb", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sso_provider", sa.Enum("google", "microsoft", "email", name="sso_provider"), nullable=False),
        sa.Column("sso_subject", sa.String(length=255), nullable=True),
        sa.Column("role", sa.Enum("admin", "user", "viewer", name="user_role"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_sso_subject"), "users", ["sso_subject"], unique=False)

    # User API Keys table
    op.create_table(
        "user_api_keys",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.Enum("openai", "anthropic", "mapbox", "google_maps", "esri", name="api_provider"), nullable=False),
        sa.Column("encrypted_key", sa.Text(), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_used", sa.DateTime(timezone=True), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_api_keys_key_hash"), "user_api_keys", ["key_hash"], unique=False)

    # Parcels table
    op.create_table(
        "parcels",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("region_code", sa.String(length=20), nullable=False),
        sa.Column("geom", geoalchemy2.types.Geometry("POLYGON", srid=4326, from_text="ST_GeomFromEWKT", name="geometry"), nullable=False),
        sa.Column("centroid", geoalchemy2.types.Geography("POINT", srid=4326, from_text="ST_GeogFromText", name="geography"), nullable=False),
        sa.Column("assessor_id", sa.String(length=50), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("lot_sqft", sa.Float(), nullable=True),
        sa.Column("lot_acres", sa.Float(), nullable=True),
        sa.Column("zoning_code", sa.String(length=50), nullable=True),
        sa.Column("attrs_jsonb", sa.JSON(), nullable=False),
        sa.Column("data_confidence", sa.Float(), nullable=True),
        sa.Column("needs_review", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_parcels_source"), "parcels", ["source"], unique=False)
    op.create_index(op.f("ix_parcels_external_id"), "parcels", ["external_id"], unique=False)
    op.create_index(op.f("ix_parcels_region_code"), "parcels", ["region_code"], unique=False)
    op.create_index(op.f("ix_parcels_assessor_id"), "parcels", ["assessor_id"], unique=False)
    op.create_index(op.f("ix_parcels_address"), "parcels", ["address"], unique=False)
    op.create_index(op.f("ix_parcels_lot_sqft"), "parcels", ["lot_sqft"], unique=False)
    op.create_index(op.f("ix_parcels_zoning_code"), "parcels", ["zoning_code"], unique=False)
    op.create_index("idx_parcels_geom", "parcels", ["geom"], unique=False, postgresql_using="gist")
    op.create_index("idx_parcels_centroid", "parcels", ["centroid"], unique=False, postgresql_using="gist")
    op.create_index("idx_parcels_region_source", "parcels", ["region_code", "source"], unique=False)

    # Building footprints table
    op.create_table(
        "footprints",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("parcel_id", sa.UUID(), nullable=False),
        sa.Column("geom", geoalchemy2.types.Geometry("POLYGON", srid=4326, from_text="ST_GeomFromEWPT", name="geometry"), nullable=False),
        sa.Column("area_sqft", sa.Float(), nullable=True),
        sa.Column("type", sa.Enum("main", "outbuilding", "driveway", "pool", "other", name="footprint_type"), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_footprints_geom", "footprints", ["geom"], unique=False, postgresql_using="gist")
    op.create_index("idx_footprints_parcel", "footprints", ["parcel_id"], unique=False)

    # Buildable areas table
    op.create_table(
        "derived_buildable",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("parcel_id", sa.UUID(), nullable=False),
        sa.Column("version", sa.String(length=50), nullable=False),
        sa.Column("settings_hash", sa.String(length=64), nullable=False),
        sa.Column("buildable_geom", geoalchemy2.types.Geometry("POLYGON", srid=4326, from_text="ST_GeomFromEWKT", name="geometry"), nullable=True),
        sa.Column("area_sqft", sa.Float(), nullable=False),
        sa.Column("metadata_jsonb", sa.JSON(), nullable=False),
        sa.Column("computation_time_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_derived_buildable_settings_hash"), "derived_buildable", ["settings_hash"], unique=False)
    op.create_index("idx_buildable_geom", "derived_buildable", ["buildable_geom"], unique=False, postgresql_using="gist")
    op.create_index("idx_buildable_parcel_hash", "derived_buildable", ["parcel_id", "settings_hash"], unique=False)

    # Zoning rules table
    op.create_table(
        "zoning_rules",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("region_code", sa.String(length=20), nullable=False),
        sa.Column("zoning_code", sa.String(length=50), nullable=False),
        sa.Column("rules_jsonb", sa.JSON(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("parsed_by", sa.String(length=50), nullable=True),
        sa.Column("parsed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_zoning_rules_region_code"), "zoning_rules", ["region_code"], unique=False)
    op.create_index(op.f("ix_zoning_rules_zoning_code"), "zoning_rules", ["zoning_code"], unique=False)
    op.create_index(op.f("ix_zoning_rules_content_hash"), "zoning_rules", ["content_hash"], unique=False)
    op.create_index("idx_zoning_region_code", "zoning_rules", ["region_code", "zoning_code"], unique=True)

    # Listings table
    op.create_table(
        "listings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("parcel_id", sa.UUID(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("active", "pending", "sold", "off_market", name="listing_status"), nullable=False),
        sa.Column("list_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sold_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("days_on_market", sa.Integer(), nullable=True),
        sa.Column("attrs_jsonb", sa.JSON(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_stale", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_listings_source"), "listings", ["source"], unique=False)
    op.create_index(op.f("ix_listings_external_id"), "listings", ["external_id"], unique=False)
    op.create_index(op.f("ix_listings_price"), "listings", ["price"], unique=False)
    op.create_index(op.f("ix_listings_status"), "listings", ["status"], unique=False)
    op.create_index("idx_listings_parcel_status", "listings", ["parcel_id", "status"], unique=False)
    op.create_index("idx_listings_source_external", "listings", ["source", "external_id"], unique=True)

    # CV artifacts table
    op.create_table(
        "cv_artifacts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("parcel_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.Enum("pool", "tree_canopy", "driveway", "shed", "other", name="cv_artifact_type"), nullable=False),
        sa.Column("geom", geoalchemy2.types.Geometry("POLYGON", srid=4326, from_text="ST_GeomFromEWKT", name="geometry"), nullable=False),
        sa.Column("area_sqft", sa.Float(), nullable=True),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("model_version", sa.String(length=50), nullable=True),
        sa.Column("detection_date", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("human_verified", sa.Boolean(), nullable=False),
        sa.Column("is_valid", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["parcel_id"], ["parcels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_cv_artifacts_type"), "cv_artifacts", ["type"], unique=False)
    op.create_index("idx_cv_artifacts_geom", "cv_artifacts", ["geom"], unique=False, postgresql_using="gist")
    op.create_index("idx_cv_artifacts_parcel_type", "cv_artifacts", ["parcel_id", "type"], unique=False)

    # Searches table
    op.create_table(
        "searches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("area_geom", geoalchemy2.types.Geography("POLYGON", srid=4326, from_text="ST_GeogFromText", name="geography"), nullable=False),
        sa.Column("area_name", sa.String(length=255), nullable=True),
        sa.Column("filters_jsonb", sa.JSON(), nullable=False),
        sa.Column("options_jsonb", sa.JSON(), nullable=False),
        sa.Column("status", sa.Enum("draft", "queued", "running", "completed", "failed", "cancelled", name="search_status"), nullable=False),
        sa.Column("total_candidates", sa.Integer(), nullable=True),
        sa.Column("filtered_count", sa.Integer(), nullable=True),
        sa.Column("results_count", sa.Integer(), nullable=True),
        sa.Column("execution_time_ms", sa.Integer(), nullable=True),
        sa.Column("stage_timings_jsonb", sa.JSON(), nullable=True),
        sa.Column("costs_jsonb", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("error_details_jsonb", sa.JSON(), nullable=True),
        sa.Column("cache_key", sa.String(length=64), nullable=True),
        sa.Column("results_cached_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_searches_status"), "searches", ["status"], unique=False)
    op.create_index(op.f("ix_searches_cache_key"), "searches", ["cache_key"], unique=False)

    # Exports table
    op.create_table(
        "exports",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("search_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.Enum("csv", "geojson", "pdf", name="export_type"), nullable=False),
        sa.Column("options_jsonb", sa.JSON(), nullable=False),
        sa.Column("status", sa.Enum("queued", "processing", "completed", "failed", "expired", name="export_status"), nullable=False),
        sa.Column("s3_bucket", sa.String(length=255), nullable=True),
        sa.Column("s3_key", sa.String(length=500), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("download_url", sa.String(length=1000), nullable=True),
        sa.Column("url_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processing_time_ms", sa.Integer(), nullable=True),
        sa.Column("records_exported", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=1000), nullable=True),
        sa.Column("error_details_jsonb", sa.JSON(), nullable=True),
        sa.Column("download_count", sa.Integer(), nullable=False),
        sa.Column("max_downloads", sa.Integer(), nullable=False),
        sa.Column("auto_delete_after_days", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["search_id"], ["searches.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_exports_type"), "exports", ["type"], unique=False)
    op.create_index(op.f("ix_exports_status"), "exports", ["status"], unique=False)

    # Audit logs table
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("resource_type", sa.String(length=50), nullable=True),
        sa.Column("resource_id", sa.UUID(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("metadata_jsonb", sa.JSON(), nullable=False),
        sa.Column("success", sa.String(length=10), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("cv_operations", sa.Integer(), nullable=False),
        sa.Column("llm_tokens", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_type"), "audit_logs", ["resource_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_resource_id"), "audit_logs", ["resource_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)

    # Create update triggers for updated_at columns
    tables_with_updated_at = [
        "organizations", "users", "user_api_keys", "parcels", "footprints", 
        "zoning_rules", "listings", "searches", "exports"
    ]
    
    for table in tables_with_updated_at:
        op.execute(f"""
            CREATE TRIGGER trigger_update_{table}_updated_at
            BEFORE UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        """)

    # Enable RLS on multi-tenant tables
    multi_tenant_tables = [
        "organizations", "users", "user_api_keys", "searches", "exports", "audit_logs"
    ]
    
    for table in multi_tenant_tables:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    # Create RLS policies
    # Organizations: users can only see their own org
    op.execute("""
        CREATE POLICY org_isolation ON organizations
        FOR ALL
        TO bbf_app
        USING (id = current_setting('app.current_org_id', true)::UUID)
    """)

    # Users: filter by org_id
    op.execute("""
        CREATE POLICY org_isolation ON users
        FOR ALL
        TO bbf_app
        USING (org_id = current_setting('app.current_org_id', true)::UUID)
    """)

    # User API keys: accessible via user's org
    op.execute("""
        CREATE POLICY org_isolation ON user_api_keys
        FOR ALL
        TO bbf_app
        USING (
            user_id IN (
                SELECT id FROM users 
                WHERE org_id = current_setting('app.current_org_id', true)::UUID
            )
        )
    """)

    # Generic org_id-based policies
    for table in ["searches", "exports", "audit_logs"]:
        op.execute(f"""
            CREATE POLICY org_isolation ON {table}
            FOR ALL
            TO bbf_app
            USING (org_id = current_setting('app.current_org_id', true)::UUID)
        """)


def downgrade() -> None:
    # Drop all tables (foreign keys will be handled automatically)
    op.drop_table("audit_logs")
    op.drop_table("exports")
    op.drop_table("searches")
    op.drop_table("cv_artifacts")
    op.drop_table("listings")
    op.drop_table("zoning_rules")
    op.drop_table("derived_buildable")
    op.drop_table("footprints")
    op.drop_table("parcels")
    op.drop_table("user_api_keys")
    op.drop_table("users")
    op.drop_table("organizations")

    # Drop custom types
    op.execute("DROP TYPE IF EXISTS search_status")
    op.execute("DROP TYPE IF EXISTS cv_artifact_type")
    op.execute("DROP TYPE IF EXISTS export_status")
    op.execute("DROP TYPE IF EXISTS export_type")
    op.execute("DROP TYPE IF EXISTS listing_status")
    op.execute("DROP TYPE IF EXISTS footprint_type")
    op.execute("DROP TYPE IF EXISTS api_provider")
    op.execute("DROP TYPE IF EXISTS sso_provider")
    op.execute("DROP TYPE IF EXISTS user_role")
    op.execute("DROP TYPE IF EXISTS plan_tier")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")

    # Note: We don't drop PostGIS extensions as they might be used by other apps