"""
Authentication endpoints using Supabase Auth
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid

from ..database import get_db
from ..models.auth import User, Organization
from ..auth.supabase_auth import supabase_auth

router = APIRouter(prefix="/auth", tags=["authentication"])

# Request/Response models
class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    organization_name: Optional[str] = None

class SignInRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    user: dict
    session: dict
    message: str

class UserProfileResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str
    organization: dict
    is_active: bool
    last_login: Optional[str]
    created_at: str

@router.post("/signup", response_model=AuthResponse)
async def sign_up(
    request: SignUpRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with Supabase Auth"""
    
    # Check if user already exists in our database
    result = await db.execute(
        select(User).where(User.email == request.email)
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    try:
        # Create user in Supabase Auth
        supabase_response = supabase_auth.create_user_in_supabase(
            email=request.email,
            password=request.password,
            name=request.name
        )
        
        supabase_user = supabase_response.user
        if not supabase_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user in Supabase"
            )
        
        # Create organization if name provided
        organization = None
        if request.organization_name:
            organization = Organization(
                name=request.organization_name,
                plan_tier="free"
            )
            db.add(organization)
            await db.flush()  # Get the ID
        else:
            # Create default personal organization
            organization = Organization(
                name=f"{request.name}'s Organization",
                plan_tier="free"
            )
            db.add(organization)
            await db.flush()
        
        # Create user profile in our database
        user = User(
            auth_user_id=uuid.UUID(supabase_user.id),
            org_id=organization.id,
            email=request.email,
            name=request.name,
            sso_provider="email",
            role="admin"  # First user in org is admin
        )
        
        db.add(user)
        await db.commit()
        
        return AuthResponse(
            user=supabase_user.model_dump(),
            session={},  # Supabase handles session management
            message="User created successfully. Please check your email for verification."
        )
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )

@router.post("/signin", response_model=AuthResponse)
async def sign_in(request: SignInRequest):
    """Sign in user with Supabase Auth"""
    
    try:
        # Use Supabase client to sign in
        response = supabase_auth.client.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })
        
        if not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )
        
        return AuthResponse(
            user=response.user.model_dump(),
            session=response.session.model_dump() if response.session else {},
            message="Signed in successfully"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Sign in failed: {str(e)}"
        )

@router.post("/signout")
async def sign_out():
    """Sign out user from Supabase Auth"""
    
    try:
        supabase_auth.client.auth.sign_out()
        return {"message": "Signed out successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sign out failed: {str(e)}"
        )

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(supabase_auth.get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user profile"""
    
    # Get organization info
    result = await db.execute(
        select(Organization).where(Organization.id == current_user.org_id)
    )
    organization = result.scalar_one()
    
    return UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        role=current_user.role,
        organization={
            "id": str(organization.id),
            "name": organization.name,
            "plan_tier": organization.plan_tier
        },
        is_active=current_user.is_active,
        last_login=current_user.last_login.isoformat() if current_user.last_login else None,
        created_at=current_user.created_at.isoformat()
    )

@router.post("/refresh")
async def refresh_token():
    """Refresh authentication token"""
    
    try:
        response = supabase_auth.client.auth.refresh_session()
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to refresh token"
            )
        
        return {
            "session": response.session.model_dump(),
            "message": "Token refreshed successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token refresh failed: {str(e)}"
        )

@router.post("/reset-password")
async def reset_password(email: EmailStr):
    """Send password reset email"""
    
    try:
        supabase_auth.client.auth.reset_password_email(email)
        return {"message": "Password reset email sent"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Password reset failed: {str(e)}"
        )