"""Audit logging models."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class AuditLog(Base):
    """Audit trail for all significant actions."""
    
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Null for system actions
    
    # Action details
    action = Column(String(100), nullable=False, index=True)  # e.g., 'search.execute', 'export.create'
    resource_type = Column(String(50), nullable=True, index=True)  # e.g., 'parcel', 'search', 'export'
    resource_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True)
    
    # Action metadata
    metadata_jsonb = Column(JSONB, nullable=False, default={})
    
    # Results
    success = Column(String(10), nullable=False, default="unknown")  # 'success', 'failure', 'unknown'
    error_message = Column(Text, nullable=True)
    
    # Performance
    duration_ms = Column(Integer, nullable=True)
    
    # Costs (for billing/monitoring)
    cv_operations = Column(Integer, nullable=False, default=0)
    llm_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="audit_logs")
    user = relationship("User", back_populates="audit_logs")

    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, action='{self.action}', success='{self.success}')>"