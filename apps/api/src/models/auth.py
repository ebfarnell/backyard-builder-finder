"""Authentication and user management models."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class Organization(Base):
    """Organization model with multi-tenant isolation."""
    
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    plan_tier = Column(
        Enum("free", "pro", "enterprise", name="plan_tier"),
        nullable=False,
        default="free"
    )
    
    # Store limits as JSONB for flexibility
    limits_jsonb = Column(JSONB, nullable=False, default={
        "monthly_searches": 10,
        "concurrent_searches": 1,
        "max_parcels_per_search": 100,
        "cv_operations_per_month": 50,
        "llm_tokens_per_month": 10000,
    })
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    searches = relationship("Search", back_populates="organization", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Organization(id={self.id}, name='{self.name}', plan='{self.plan_tier}')>"


class User(Base):
    """User model with SSO support and role-based access."""
    
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    # Basic profile
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    
    # Authentication
    sso_provider = Column(
        Enum("google", "microsoft", "email", name="sso_provider"),
        nullable=False,
        default="email"
    )
    sso_subject = Column(String(255), nullable=True, index=True)  # External user ID
    
    # Authorization
    role = Column(
        Enum("admin", "user", "viewer", name="user_role"),
        nullable=False,
        default="user"
    )
    
    # Status
    is_active = Column(Boolean, nullable=False, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    api_keys = relationship("UserApiKey", back_populates="user", cascade="all, delete-orphan")
    searches = relationship("Search", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"


class UserApiKey(Base):
    """Encrypted storage for user-provided API keys."""
    
    __tablename__ = "user_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Key information
    provider = Column(
        Enum("openai", "anthropic", "mapbox", "google_maps", "esri", name="api_provider"),
        nullable=False
    )
    
    # Encrypted key (encrypted with KMS)
    encrypted_key = Column(Text, nullable=False)
    key_hash = Column(String(64), nullable=False, index=True)  # SHA-256 hash for deduplication
    
    # Key metadata
    name = Column(String(255), nullable=True)  # User-friendly name
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Usage tracking
    last_used = Column(DateTime(timezone=True), nullable=True)
    usage_count = Column(Integer, nullable=False, default=0)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="api_keys")

    def __repr__(self) -> str:
        return f"<UserApiKey(id={self.id}, provider='{self.provider}', active={self.is_active})>"


# Enable row-level security policies
def enable_rls_policies(target, connection, **kw):
    """Enable RLS policies after table creation."""
    if hasattr(target, '__tablename__'):
        table_name = target.__tablename__
        
        # Enable RLS on multi-tenant tables
        if table_name in ['organizations', 'users', 'user_api_keys', 'searches', 'exports', 'audit_logs']:
            connection.execute(f"ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY")
            
            # Create policies based on org_id
            if table_name == 'organizations':
                # Organizations: users can only see their own org
                connection.execute(f"""
                    CREATE POLICY org_isolation ON {table_name}
                    FOR ALL
                    TO bbf_app
                    USING (id = current_setting('app.current_org_id')::UUID)
                """)
            else:
                # Other tables: filter by org_id
                if table_name == 'users':
                    connection.execute(f"""
                        CREATE POLICY org_isolation ON {table_name}
                        FOR ALL
                        TO bbf_app
                        USING (org_id = current_setting('app.current_org_id')::UUID)
                    """)
                elif table_name == 'user_api_keys':
                    # API keys: accessible via user's org
                    connection.execute(f"""
                        CREATE POLICY org_isolation ON {table_name}
                        FOR ALL
                        TO bbf_app
                        USING (
                            user_id IN (
                                SELECT id FROM users 
                                WHERE org_id = current_setting('app.current_org_id')::UUID
                            )
                        )
                    """)
                else:
                    # Generic org_id-based policy
                    connection.execute(f"""
                        CREATE POLICY org_isolation ON {table_name}
                        FOR ALL
                        TO bbf_app
                        USING (org_id = current_setting('app.current_org_id')::UUID)
                    """)


# Attach RLS setup to table creation events
from sqlalchemy import event

event.listen(Organization.__table__, 'after_create', enable_rls_policies)
event.listen(User.__table__, 'after_create', enable_rls_policies)
event.listen(UserApiKey.__table__, 'after_create', enable_rls_policies)