"""Application configuration management."""

import os
from typing import List, Optional

from pydantic import validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with validation."""
    
    # ========================
    # GENERAL
    # ========================
    
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    VERSION: str = "1.0.0"
    
    # ========================
    # DATABASE
    # ========================
    
    DATABASE_URL: str = "postgresql+asyncpg://bbf_dev:bbf_dev@localhost:5432/bbf_dev"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 0
    DATABASE_POOL_RECYCLE: int = 300
    
    # ========================
    # SUPABASE
    # ========================
    
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    
    # ========================
    # REDIS CACHE
    # ========================
    
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL_SECONDS: int = 3600
    
    # ========================
    # SECURITY
    # ========================
    
    JWT_SECRET: str = "dev-jwt-secret-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000", 
        "http://localhost:3001",
        "https://backyard-builder-finder.netlify.app",
        "https://main--backyard-builder-finder.netlify.app"
    ]
    ALLOWED_HOSTS: List[str] = ["*"]
    
    # API Keys encryption (KMS in production)
    ENCRYPTION_KEY: Optional[str] = None
    KMS_KEY_ID: Optional[str] = None
    
    # ========================
    # EXTERNAL SERVICES
    # ========================
    
    # AWS
    AWS_REGION: str = "us-west-2"
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
    # S3 Buckets
    S3_EXPORTS_BUCKET: Optional[str] = None
    S3_CACHE_BUCKET: Optional[str] = None
    
    # Default LLM providers (fallback when user keys not available)
    OPENAI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    
    # Geocoding services
    NOMINATIM_USER_AGENT: str = "BackyardBuilderFinder/1.0"
    NOMINATIM_BASE_URL: str = "https://nominatim.openstreetmap.org"
    
    # ========================
    # FEATURE FLAGS
    # ========================
    
    ENABLE_CV_PROCESSING: bool = False
    ENABLE_LLM_PROCESSING: bool = True
    ENABLE_PORTAL_SCRAPING: bool = False  # DISABLED by default - requires ToS acceptance
    
    # ========================
    # PERFORMANCE & LIMITS
    # ========================
    
    # Rate limits
    MAX_CONCURRENT_SEARCHES_PER_ORG: int = 5
    MAX_PARCELS_PER_SEARCH: int = 10000
    MAX_SEARCH_AREA_SQKM: float = 100.0
    
    # Processing timeouts
    SEARCH_TIMEOUT_SECONDS: int = 600
    CV_OPERATION_TIMEOUT_SECONDS: int = 30
    LLM_REQUEST_TIMEOUT_SECONDS: int = 30
    
    # Cost controls
    MAX_CV_OPERATIONS_PER_SEARCH: int = 100
    MAX_LLM_TOKENS_PER_SEARCH: int = 10000
    
    # ========================
    # MONITORING
    # ========================
    
    LOG_LEVEL: str = "INFO"
    ENABLE_METRICS: bool = True
    SENTRY_DSN: Optional[str] = None
    
    # ========================
    # VALIDATION
    # ========================
    
    @validator("ENVIRONMENT")
    def validate_environment(cls, v):
        """Validate environment setting."""
        allowed = ["development", "staging", "production"]
        if v not in allowed:
            raise ValueError(f"Environment must be one of: {allowed}")
        return v
    
    @validator("DEBUG", pre=True)
    def set_debug_from_environment(cls, v, values):
        """Set DEBUG based on ENVIRONMENT if not explicitly set."""
        if isinstance(v, str):
            v = v.lower() in ("true", "1", "yes", "on")
        
        # Override DEBUG based on environment
        if values.get("ENVIRONMENT") == "development" and v is None:
            return True
        elif values.get("ENVIRONMENT") == "production":
            return False
        
        return v
    
    @validator("CORS_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("ALLOWED_HOSTS", pre=True)  
    def parse_allowed_hosts(cls, v):
        """Parse allowed hosts from string or list."""
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()


def get_database_url_sync() -> str:
    """Get synchronous database URL for Alembic."""
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")


def is_production() -> bool:
    """Check if running in production environment."""
    return settings.ENVIRONMENT == "production"


def is_development() -> bool:
    """Check if running in development environment."""
    return settings.ENVIRONMENT == "development"