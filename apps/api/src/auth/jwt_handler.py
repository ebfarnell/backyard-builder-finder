"""JWT token handling for authentication."""

from datetime import datetime, timedelta
from typing import Dict, Optional

import jwt
from fastapi import HTTPException, status

from ..core.config import settings


def create_jwt_token(
    user_id: str,
    org_id: str,
    email: str,
    role: str = "user",
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create a JWT token for a user."""
    
    if expires_delta is None:
        expires_delta = timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    
    expire = datetime.utcnow() + expires_delta
    
    payload = {
        "sub": user_id,
        "org_id": org_id,
        "email": email,
        "role": role,
        "exp": expire,
        "iat": datetime.utcnow(),
        "iss": "backyard-builder-finder",
    }
    
    token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    
    return token


def decode_jwt_token(token: str) -> Dict:
    """Decode and validate a JWT token."""
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"require_exp": True, "require_iat": True},
        )
        
        # Validate required fields
        required_fields = ["sub", "org_id", "email"]
        for field in required_fields:
            if field not in payload:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Token missing required field: {field}",
                )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


def refresh_jwt_token(token: str) -> str:
    """Refresh a JWT token if it's close to expiry."""
    
    try:
        # Decode without verifying expiration
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
        
        # Check if token is within refresh window (last 25% of validity period)
        exp = datetime.fromtimestamp(payload["exp"])
        iat = datetime.fromtimestamp(payload["iat"])
        token_lifetime = exp - iat
        refresh_threshold = exp - (token_lifetime * 0.25)
        
        if datetime.utcnow() < refresh_threshold:
            # Token doesn't need refresh yet
            return token
        
        # Create new token with same payload (except timestamps)
        return create_jwt_token(
            user_id=payload["sub"],
            org_id=payload["org_id"],
            email=payload["email"],
            role=payload.get("role", "user"),
        )
        
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cannot refresh invalid token",
        )


def validate_token_permissions(token: str, required_role: str = "user") -> Dict:
    """Validate token and check role permissions."""
    
    payload = decode_jwt_token(token)
    user_role = payload.get("role", "user")
    
    # Role hierarchy: admin > user > viewer
    role_hierarchy = {"admin": 3, "user": 2, "viewer": 1}
    
    required_level = role_hierarchy.get(required_role, 1)
    user_level = role_hierarchy.get(user_role, 1)
    
    if user_level < required_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions. Required: {required_role}, User: {user_role}",
        )
    
    return payload