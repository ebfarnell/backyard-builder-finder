"""Export and file generation models."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
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


class Export(Base):
    """Export jobs and generated files."""
    
    __tablename__ = "exports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    search_id = Column(UUID(as_uuid=True), ForeignKey("searches.id"), nullable=False)
    
    # Export configuration
    type = Column(
        Enum("csv", "geojson", "pdf", name="export_type"),
        nullable=False,
        index=True
    )
    
    # Export options
    options_jsonb = Column(JSONB, nullable=False, default={})  # Include geometry, listings, etc.
    
    # Processing status
    status = Column(
        Enum("queued", "processing", "completed", "failed", "expired", name="export_status"),
        nullable=False,
        default="queued",
        index=True
    )
    
    # File information
    s3_bucket = Column(String(255), nullable=True)
    s3_key = Column(String(500), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    download_url = Column(String(1000), nullable=True)  # Pre-signed URL
    url_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Processing metrics
    processing_time_ms = Column(Integer, nullable=True)
    records_exported = Column(Integer, nullable=True)
    
    # Error handling
    error_message = Column(String(1000), nullable=True)
    error_details_jsonb = Column(JSONB, nullable=True)
    
    # Security and cleanup
    download_count = Column(Integer, nullable=False, default=0)
    max_downloads = Column(Integer, nullable=False, default=10)
    auto_delete_after_days = Column(Integer, nullable=False, default=7)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="exports")
    search = relationship("Search", back_populates="exports")

    def __repr__(self) -> str:
        return f"<Export(id={self.id}, type='{self.type}', status='{self.status}')>"