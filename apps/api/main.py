"""FastAPI application for Backyard Builder Finder."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.core.logging import setup_logging
from src.routers import (
    admin,
    auth_supabase,
    exports,
    health,
    parcels,
    search,
    utilities,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    setup_logging()
    yield
    # Shutdown (if needed)


app = FastAPI(
    title="Backyard Builder Finder API",
    description="Multi-tenant SaaS for finding buildable space in residential backyards",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# Security middleware
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS
    )

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Note: Authentication is now handled by Supabase Auth
# No custom middleware needed


# Exception handlers
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions."""
    import traceback
    
    error_id = f"err_{int(request.state.request_id[-8:], 16):08x}" if hasattr(request.state, 'request_id') else "unknown"
    
    if settings.DEBUG:
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Internal server error ({error_id})",
                "debug": {
                    "type": type(exc).__name__,
                    "message": str(exc),
                    "traceback": traceback.format_exc(),
                }
            }
        )
    else:
        # Log error for monitoring in production
        import structlog
        logger = structlog.get_logger()
        logger.error(
            "Unhandled exception",
            error_id=error_id,
            exception=str(exc),
            traceback=traceback.format_exc(),
            path=request.url.path,
            method=request.method,
        )
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"Internal server error ({error_id})",
                "metadata": {"error_id": error_id}
            }
        )


# Include routers
app.include_router(health.router, prefix="", tags=["Health"])
app.include_router(auth_supabase.router, tags=["Authentication"])
app.include_router(search.router, prefix="/search", tags=["Search"])
app.include_router(parcels.router, prefix="/parcels", tags=["Parcels"])
app.include_router(exports.router, prefix="/exports", tags=["Exports"])
app.include_router(utilities.router, prefix="/utilities", tags=["Utilities"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Backyard Builder Finder API",
        "version": "1.0.0",
        "status": "operational",
        "docs_url": "/docs" if settings.DEBUG else None,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_config=None,  # We handle logging ourselves
    )