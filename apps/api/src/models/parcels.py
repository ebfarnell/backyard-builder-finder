"""Parcel and property-related models."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from geoalchemy2 import Geography, Geometry
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Parcel(Base):
    """Parcel/lot information with geometry and attributes."""
    
    __tablename__ = "parcels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Data source tracking
    source = Column(String(100), nullable=False, index=True)  # e.g., 'arcgis_la_county'
    external_id = Column(String(255), nullable=False, index=True)  # Source-specific ID
    region_code = Column(String(20), nullable=False, index=True)  # e.g., 'US_CA_LA'
    
    # Geometry (using SRID 4326 for consistency)
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    centroid = Column(Geography('POINT', srid=4326), nullable=False)
    
    # Basic attributes from assessor/parcel data
    assessor_id = Column(String(50), nullable=True, index=True)
    address = Column(String(500), nullable=True, index=True)
    
    # Lot information
    lot_sqft = Column(Float, nullable=True, index=True)
    lot_acres = Column(Float, nullable=True)
    
    # Zoning
    zoning_code = Column(String(50), nullable=True, index=True)
    
    # Extended attributes stored as JSONB for flexibility
    # This can include: owner info, tax info, sale history, etc.
    attrs_jsonb = Column(JSONB, nullable=False, default={})
    
    # Data quality and processing
    data_confidence = Column(Float, nullable=True)  # 0.0 to 1.0
    needs_review = Column(Boolean, nullable=False, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    footprints = relationship("BuildingFootprint", back_populates="parcel", cascade="all, delete-orphan")
    buildable_areas = relationship("BuildableArea", back_populates="parcel", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="parcel", cascade="all, delete-orphan")
    cv_artifacts = relationship("CVArtifact", back_populates="parcel", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Parcel(id={self.id}, source='{self.source}', external_id='{self.external_id}')>"


# Create spatial indexes
Index('idx_parcels_geom', Parcel.geom, postgresql_using='gist')
Index('idx_parcels_centroid', Parcel.centroid, postgresql_using='gist')
Index('idx_parcels_region_source', Parcel.region_code, Parcel.source)


class BuildingFootprint(Base):
    """Building footprints and other structures on parcels."""
    
    __tablename__ = "footprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    
    # Geometry
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    area_sqft = Column(Float, nullable=True)
    
    # Classification
    type = Column(
        Enum("main", "outbuilding", "driveway", "pool", "other", name="footprint_type"),
        nullable=False,
        default="main"
    )
    
    # Data source
    source = Column(String(100), nullable=False)  # e.g., 'microsoft_buildings', 'osm', 'cv_detection'
    confidence = Column(Float, nullable=True)  # 0.0 to 1.0 for ML-detected features
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    parcel = relationship("Parcel", back_populates="footprints")

    def __repr__(self) -> str:
        return f"<BuildingFootprint(id={self.id}, type='{self.type}', source='{self.source}')>"


Index('idx_footprints_geom', BuildingFootprint.geom, postgresql_using='gist')
Index('idx_footprints_parcel', BuildingFootprint.parcel_id)


class BuildableArea(Base):
    """Computed buildable area for parcels after applying setbacks and exclusions."""
    
    __tablename__ = "derived_buildable"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    
    # Computation versioning
    version = Column(String(50), nullable=False, default="1.0")  # Algorithm version
    settings_hash = Column(String(64), nullable=False, index=True)  # SHA-256 of input parameters
    
    # Results
    buildable_geom = Column(Geometry('POLYGON', srid=4326), nullable=True)  # Can be NULL if no buildable area
    area_sqft = Column(Float, nullable=False, default=0.0)
    
    # Computation metadata
    metadata_jsonb = Column(JSONB, nullable=False, default={})  # Setbacks used, obstacles removed, etc.
    
    # Performance tracking
    computation_time_ms = Column(Integer, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    parcel = relationship("Parcel", back_populates="buildable_areas")

    def __repr__(self) -> str:
        return f"<BuildableArea(id={self.id}, area_sqft={self.area_sqft}, version='{self.version}')>"


Index('idx_buildable_geom', BuildableArea.buildable_geom, postgresql_using='gist')
Index('idx_buildable_parcel_hash', BuildableArea.parcel_id, BuildableArea.settings_hash)


class ZoningRule(Base):
    """Zoning rules and regulations parsed from various sources."""
    
    __tablename__ = "zoning_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Geographic scope
    region_code = Column(String(20), nullable=False, index=True)
    zoning_code = Column(String(50), nullable=False, index=True)
    
    # Parsed rules as structured JSON
    rules_jsonb = Column(JSONB, nullable=False, default={})
    
    # Source information
    source = Column(String(100), nullable=False)  # e.g., 'la_county_zoning_api'
    source_url = Column(Text, nullable=True)
    
    # LLM parsing metadata
    parsed_by = Column(String(50), nullable=True)  # e.g., 'openai_gpt4', 'anthropic_claude'
    parsed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Content hash for change detection
    content_hash = Column(String(64), nullable=False, index=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    def __repr__(self) -> str:
        return f"<ZoningRule(id={self.id}, region='{self.region_code}', code='{self.zoning_code}')>"


Index('idx_zoning_region_code', ZoningRule.region_code, ZoningRule.zoning_code, unique=True)


class Listing(Base):
    """Real estate listings for parcels."""
    
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    
    # Source tracking
    source = Column(String(100), nullable=False, index=True)  # e.g., 'reso_mls', 'zillow_api'
    external_id = Column(String(255), nullable=False, index=True)
    url = Column(Text, nullable=True)
    
    # Listing details
    price = Column(Integer, nullable=True, index=True)  # Price in cents to avoid float issues
    status = Column(
        Enum("active", "pending", "sold", "off_market", name="listing_status"),
        nullable=False,
        default="active",
        index=True
    )
    
    # Dates
    list_date = Column(DateTime(timezone=True), nullable=True)
    sold_date = Column(DateTime(timezone=True), nullable=True)
    days_on_market = Column(Integer, nullable=True)
    
    # Extended attributes
    attrs_jsonb = Column(JSONB, nullable=False, default={})  # Photos, description, agent info, etc.
    
    # Data tracking
    last_seen_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    is_stale = Column(Boolean, nullable=False, default=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    parcel = relationship("Parcel", back_populates="listings")

    def __repr__(self) -> str:
        return f"<Listing(id={self.id}, source='{self.source}', status='{self.status}', price={self.price})>"


Index('idx_listings_parcel_status', Listing.parcel_id, Listing.status)
Index('idx_listings_source_external', Listing.source, Listing.external_id, unique=True)


class CVArtifact(Base):
    """Computer vision detected features on parcels."""
    
    __tablename__ = "cv_artifacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    parcel_id = Column(UUID(as_uuid=True), ForeignKey("parcels.id"), nullable=False)
    
    # Detection results
    type = Column(
        Enum("pool", "tree_canopy", "driveway", "shed", "other", name="cv_artifact_type"),
        nullable=False,
        index=True
    )
    geom = Column(Geometry('POLYGON', srid=4326), nullable=False)
    area_sqft = Column(Float, nullable=True)
    
    # ML metadata
    source = Column(String(100), nullable=False)  # e.g., 'onnx_pool_detector_v1.2'
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    
    # Processing metadata
    model_version = Column(String(50), nullable=True)
    detection_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    
    # Quality control
    human_verified = Column(Boolean, nullable=False, default=False)
    is_valid = Column(Boolean, nullable=True)  # NULL = unreviewed, True/False = reviewed
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    parcel = relationship("Parcel", back_populates="cv_artifacts")

    def __repr__(self) -> str:
        return f"<CVArtifact(id={self.id}, type='{self.type}', confidence={self.confidence})>"


Index('idx_cv_artifacts_geom', CVArtifact.geom, postgresql_using='gist')
Index('idx_cv_artifacts_parcel_type', CVArtifact.parcel_id, CVArtifact.type)