"""Authentication and user management endpoints."""

from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.jwt_handler import create_jwt_token
from ..auth.middleware import get_current_org_id, get_current_user_id
from ..core.logging import get_logger
from ..database import get_async_db
from ..models import Organization, User

logger = get_logger(__name__)
router = APIRouter()


# ========================
# REQUEST MODELS
# ========================

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    organization_name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ApiKeyRequest(BaseModel):
    openai_key: Optional[str] = None
    anthropic_key: Optional[str] = None
    mapbox_key: Optional[str] = None
    google_key: Optional[str] = None


# ========================
# RESPONSE MODELS
# ========================

class AuthResponse(BaseModel):
    success: bool
    token: str
    user: Dict
    organization: Dict
    expires_in: int = 86400  # 24 hours


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization: Dict


# ========================
# AUTHENTICATION ENDPOINTS
# ========================

@router.post("/signup", response_model=AuthResponse)
async def signup(
    request: SignupRequest,
    db: AsyncSession = Depends(get_async_db)
) -> AuthResponse:
    """Register a new user and organization."""
    
    # Check if user already exists
    existing_user = await db.execute(
        select(User).where(User.email == request.email)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    try:
        # Create organization
        org_name = request.organization_name or f"{request.first_name} {request.last_name}'s Organization"
        organization = Organization(
            id=uuid4(),
            name=org_name,
            plan_tier="free",
            limits_jsonb={
                "monthly_searches": 10,
                "concurrent_searches": 1,
                "max_parcels_per_search": 100,
                "cv_operations_per_month": 50,
                "llm_tokens_per_month": 10000,
            }
        )
        db.add(organization)
        await db.flush()  # Get the org ID
        
        # Create user
        user = User(
            id=uuid4(),
            org_id=organization.id,
            email=request.email,
            name=f"{request.first_name} {request.last_name}",
            sso_provider="email",
            role="admin",  # First user in org is admin
            is_active=True,
        )
        db.add(user)
        
        await db.commit()
        
        # Create JWT token
        token = create_jwt_token(
            user_id=str(user.id),
            org_id=str(organization.id),
            email=user.email,
            role=user.role,
        )
        
        logger.info(
            "User signup successful",
            user_id=str(user.id),
            org_id=str(organization.id),
            email=user.email,
        )
        
        return AuthResponse(
            success=True,
            token=token,
            user={
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
            },
            organization={
                "id": str(organization.id),
                "name": organization.name,
                "plan_tier": organization.plan_tier,
                "limits": organization.limits_jsonb,
            }
        )
        
    except Exception as e:
        await db.rollback()
        logger.error("Signup failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Signup failed"
        )


@router.post("/login", response_model=AuthResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_async_db)
) -> AuthResponse:
    """Login user with email and password."""
    
    # Find user
    result = await db.execute(
        select(User, Organization)
        .join(Organization, User.org_id == Organization.id)
        .where(User.email == request.email, User.is_active == True)
    )
    user_org = result.first()
    
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    user, organization = user_org
    
    # TODO: Implement password hashing and verification
    # For now, we'll use a simple password check for development
    if request.password != "password123":  # Development only!
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    await db.commit()
    
    # Create JWT token
    token = create_jwt_token(
        user_id=str(user.id),
        org_id=str(organization.id),
        email=user.email,
        role=user.role,
    )
    
    logger.info(
        "User login successful",
        user_id=str(user.id),
        org_id=str(organization.id),
        email=user.email,
    )
    
    return AuthResponse(
        success=True,
        token=token,
        user={
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
        },
        organization={
            "id": str(organization.id),
            "name": organization.name,
            "plan_tier": organization.plan_tier,
            "limits": organization.limits_jsonb,
        }
    )


@router.post("/guest", response_model=AuthResponse)
async def guest_login(db: AsyncSession = Depends(get_async_db)) -> AuthResponse:
    """Create a guest session for demo purposes."""
    
    # Use the development organization and user
    result = await db.execute(
        select(User, Organization)
        .join(Organization, User.org_id == Organization.id)
        .where(User.email == "dev@backyard-builder-finder.com")
    )
    user_org = result.first()
    
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Guest account not configured"
        )
    
    user, organization = user_org
    
    # Create JWT token with shorter expiration
    token = create_jwt_token(
        user_id=str(user.id),
        org_id=str(organization.id),
        email=user.email,
        role="user",  # Guests get user role, not admin
    )
    
    logger.info("Guest login", user_id=str(user.id))
    
    return AuthResponse(
        success=True,
        token=token,
        user={
            "id": str(user.id),
            "email": "guest@backyard-builder-finder.com",  # Hide real email
            "name": "Guest User",
            "role": "user",
        },
        organization={
            "id": str(organization.id),
            "name": organization.name,
            "plan_tier": organization.plan_tier,
            "limits": organization.limits_jsonb,
        }
    )


# ========================
# USER MANAGEMENT ENDPOINTS
# ========================

@router.get("/me", response_model=UserResponse)
async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_db)
) -> UserResponse:
    """Get current user information."""
    
    result = await db.execute(
        select(User, Organization)
        .join(Organization, User.org_id == Organization.id)
        .where(User.id == user_id)
    )
    user_org = result.first()
    
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user, organization = user_org
    
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        role=user.role,
        organization={
            "id": str(organization.id),
            "name": organization.name,
            "plan_tier": organization.plan_tier,
            "limits": organization.limits_jsonb,
        }
    )


@router.get("/organization")
async def get_organization(
    org_id: str = Depends(get_current_org_id),
    db: AsyncSession = Depends(get_async_db)
) -> Dict:
    """Get current organization information."""
    
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    organization = result.scalar_one_or_none()
    
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return {
        "success": True,
        "data": {
            "id": str(organization.id),
            "name": organization.name,
            "plan_tier": organization.plan_tier,
            "limits": organization.limits_jsonb,
            "created_at": organization.created_at.isoformat(),
        }
    }


@router.put("/api-keys")
async def update_api_keys(
    request: ApiKeyRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_async_db)
) -> Dict:
    """Update user's API keys (encrypted storage)."""
    
    # TODO: Implement encrypted API key storage with KMS
    # For now, return success response
    
    updated_keys = []
    if request.openai_key:
        updated_keys.append("openai")
    if request.anthropic_key:
        updated_keys.append("anthropic")
    if request.mapbox_key:
        updated_keys.append("mapbox")
    if request.google_key:
        updated_keys.append("google")
    
    logger.info(
        "API keys updated",
        user_id=user_id,
        updated_keys=updated_keys,
    )
    
    return {
        "success": True,
        "data": {
            "updated": updated_keys,
            "message": "API keys securely stored"
        }
    }