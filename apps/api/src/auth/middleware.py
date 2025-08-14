"""Authentication middleware for request processing."""

import uuid
from contextvars import ContextVar
from typing import Optional

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from ..core.config import settings
from ..core.logging import get_logger
from .jwt_handler import decode_jwt_token

logger = get_logger(__name__)

# Context variables for request scoping
request_id_var: ContextVar[str] = ContextVar('request_id')
user_id_var: ContextVar[Optional[str]] = ContextVar('user_id', default=None)
org_id_var: ContextVar[Optional[str]] = ContextVar('org_id', default=None)


class AuthMiddleware(BaseHTTPMiddleware):
    """JWT authentication and request context middleware."""
    
    # Public endpoints that don't require authentication
    PUBLIC_PATHS = {
        "/",
        "/docs",
        "/redoc",
        "/openapi.json",
        "/health",
        "/healthz",
        "/auth/login",
        "/auth/signup",
        "/auth/guest",
    }
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next) -> Response:
        """Process request through authentication middleware."""
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request_id_var.set(request_id)
        request.state.request_id = request_id
        
        # Skip auth for public endpoints
        if self._is_public_path(request.url.path):
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        
        # Extract and validate JWT token
        token = self._extract_token(request)
        if not token:
            return self._unauthorized_response("Missing authentication token")
        
        try:
            # Decode and validate JWT
            payload = decode_jwt_token(token)
            user_id = payload.get("sub")
            org_id = payload.get("org_id")
            
            if not user_id or not org_id:
                return self._unauthorized_response("Invalid token payload")
            
            # Set context variables for the request
            user_id_var.set(user_id)
            org_id_var.set(org_id)
            
            # Add to request state for easy access
            request.state.user_id = user_id
            request.state.org_id = org_id
            request.state.user_role = payload.get("role", "user")
            request.state.user_email = payload.get("email")
            
            logger.info(
                "Authenticated request",
                user_id=user_id,
                org_id=org_id,
                path=request.url.path,
                method=request.method,
            )
            
        except Exception as e:
            logger.warning(
                "Authentication failed",
                error=str(e),
                path=request.url.path,
                method=request.method,
            )
            return self._unauthorized_response(f"Authentication failed: {str(e)}")
        
        # Process request
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        
        return response
    
    def _is_public_path(self, path: str) -> bool:
        """Check if path is publicly accessible."""
        # Exact match
        if path in self.PUBLIC_PATHS:
            return True
        
        # Prefix matches for API docs
        if path.startswith(("/docs", "/redoc", "/openapi")):
            return True
        
        # Health check variations
        if path in ("/health", "/healthz", "/ping"):
            return True
        
        return False
    
    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from request headers."""
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        
        if not auth_header.startswith("Bearer "):
            return None
        
        return auth_header[7:]  # Remove "Bearer " prefix
    
    def _unauthorized_response(self, message: str) -> JSONResponse:
        """Return standardized unauthorized response."""
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "success": False,
                "error": "Unauthorized",
                "message": message,
            },
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_id() -> Optional[str]:
    """Get current user ID from context."""
    try:
        return user_id_var.get()
    except LookupError:
        return None


def get_current_org_id() -> Optional[str]:
    """Get current organization ID from context."""
    try:
        return org_id_var.get()
    except LookupError:
        return None


def get_current_request_id() -> Optional[str]:
    """Get current request ID from context."""
    try:
        return request_id_var.get()
    except LookupError:
        return None