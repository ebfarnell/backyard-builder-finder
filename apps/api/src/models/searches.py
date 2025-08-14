"""Search and filter models."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from geoalchemy2 import Geography
from sqlalchemy import (
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Search(Base):
    """Saved searches with filters and area definitions."""
    
    __tablename__ = "searches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Search definition
    name = Column(String(255), nullable=False)
    
    # Geographic area
    area_geom = Column(Geography('POLYGON', srid=4326), nullable=False)
    area_name = Column(String(255), nullable=True)  # Human-readable name
    
    # Search filters stored as JSONB for flexibility
    filters_jsonb = Column(JSONB, nullable=False, default={})
    
    # Search options
    options_jsonb = Column(JSONB, nullable=False, default={})
    
    # Execution tracking
    status = Column(
        Enum("draft", "queued", "running", "completed", "failed", "cancelled", name="search_status"),
        nullable=False,
        default="draft",
        index=True
    )
    
    # Results summary
    total_candidates = Column(Integer, nullable=True)
    filtered_count = Column(Integer, nullable=True)
    results_count = Column(Integer, nullable=True)
    
    # Performance metrics
    execution_time_ms = Column(Integer, nullable=True)
    stage_timings_jsonb = Column(JSONB, nullable=True)
    costs_jsonb = Column(JSONB, nullable=True)  # CV ops, LLM tokens, estimated USD
    
    # Error handling
    error_message = Column(String(1000), nullable=True)
    error_details_jsonb = Column(JSONB, nullable=True)
    
    # Caching
    cache_key = Column(String(64), nullable=True, index=True)  # SHA-256 of search parameters
    results_cached_until = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="searches")
    user = relationship("User", back_populates="searches")
    exports = relationship("Export", back_populates="search", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Search(id={self.id}, name='{self.name}', status='{self.status}')>"