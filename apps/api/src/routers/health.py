"""Health check and system status endpoints."""

import asyncio
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..database import get_async_db

router = APIRouter()


@router.get("/health")
async def comprehensive_health_check(db: AsyncSession = Depends(get_async_db)) -> Dict:
    """Comprehensive health check with database and external service status."""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "components": {},
    }
    
    # Database health
    try:
        start_time = datetime.utcnow()
        result = await db.execute(text("SELECT 1"))
        db_response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Test PostGIS
        postgis_result = await db.execute(text("SELECT PostGIS_Version()"))
        postgis_version = postgis_result.scalar()
        
        health_status["components"]["database"] = {
            "status": "healthy",
            "response_time_ms": round(db_response_time, 2),
            "postgis_version": postgis_version,
        }
        
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e),
        }
    
    # Redis health (if configured)
    if settings.REDIS_URL:
        try:
            import aioredis
            redis = aioredis.from_url(settings.REDIS_URL)
            start_time = datetime.utcnow()
            await redis.ping()
            redis_response_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            await redis.close()
            
            health_status["components"]["redis"] = {
                "status": "healthy",
                "response_time_ms": round(redis_response_time, 2),
            }
            
        except Exception as e:
            health_status["components"]["redis"] = {
                "status": "unhealthy",
                "error": str(e),
            }
    
    # Check external services
    external_services = await check_external_services()
    health_status["components"]["external_services"] = external_services
    
    # Overall status determination
    component_statuses = [
        comp.get("status", "unknown") 
        for comp in health_status["components"].values()
    ]
    
    if "unhealthy" in component_statuses:
        health_status["status"] = "unhealthy"
    elif "degraded" in component_statuses:
        health_status["status"] = "degraded"
    
    return health_status


@router.get("/healthz")
async def simple_health_check() -> Dict[str, str]:
    """Simple health check for load balancers."""
    return {"status": "ok"}


@router.get("/ping")
async def ping() -> Dict[str, str]:
    """Simple ping endpoint."""
    return {"message": "pong"}


async def check_external_services() -> Dict:
    """Check status of external services."""
    
    services = {}
    
    # Nominatim geocoding service
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{settings.NOMINATIM_BASE_URL}/status.php",
                params={"format": "json"}
            )
            if response.status_code == 200:
                services["nominatim"] = {
                    "status": "healthy",
                    "response_time_ms": response.elapsed.total_seconds() * 1000,
                }
            else:
                services["nominatim"] = {
                    "status": "degraded",
                    "http_status": response.status_code,
                }
    except Exception as e:
        services["nominatim"] = {
            "status": "unhealthy",
            "error": str(e),
        }
    
    # AWS services (if configured)
    if settings.S3_EXPORTS_BUCKET:
        try:
            import boto3
            s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
            
            # Simple head bucket operation
            s3_client.head_bucket(Bucket=settings.S3_EXPORTS_BUCKET)
            services["s3"] = {
                "status": "healthy",
                "bucket": settings.S3_EXPORTS_BUCKET,
            }
            
        except Exception as e:
            services["s3"] = {
                "status": "unhealthy",
                "error": str(e),
            }
    
    return services