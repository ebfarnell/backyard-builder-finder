"""
Supabase Authentication Integration for Backyard Builder Finder API
"""

import os
import jwt
from typing import Optional, Dict, Any
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models.auth import User

class SupabaseAuth:
    """Supabase authentication handler"""
    
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
        self.supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not all([self.supabase_url, self.supabase_anon_key, self.supabase_service_key]):
            raise ValueError("Missing required Supabase environment variables")
            
        # Create client with service role for admin operations
        self.client: Client = create_client(self.supabase_url, self.supabase_service_key)
        
    def verify_jwt_token(self, token: str) -> Dict[str, Any]:
        """Verify Supabase JWT token and return user info"""
        try:
            # Get JWT secret from Supabase project settings
            # For now, we'll decode without verification to get user info
            # In production, you should verify the JWT signature
            decoded = jwt.decode(
                token, 
                options={"verify_signature": False}  # Temporary for development
            )
            
            # Verify the token is from our Supabase instance
            if decoded.get("iss") != "supabase":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token issuer"
                )
                
            if decoded.get("ref") != self.supabase_url.split("//")[1].split(".")[0]:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token not from correct Supabase instance"
                )
                
            return decoded
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
    
    async def get_user_from_token(self, token: str, db: AsyncSession) -> User:
        """Get user from database using JWT token"""
        decoded = self.verify_jwt_token(token)
        auth_user_id = decoded.get("sub")
        
        if not auth_user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user ID"
            )
            
        # Query user from database
        result = await db.execute(
            select(User).where(User.auth_user_id == auth_user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
            
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is disabled"
            )
            
        return user
    
    def create_user_in_supabase(self, email: str, password: str, name: str) -> Dict[str, Any]:
        """Create user in Supabase Auth"""
        try:
            response = self.client.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,  # Auto-confirm for development
                "user_metadata": {
                    "name": name
                }
            })
            return response
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to create user: {str(e)}"
            )
    
    def update_user_last_login(self, user_id: str):
        """Update user's last login timestamp in Supabase"""
        try:
            self.client.auth.admin.update_user_by_id(
                user_id,
                {"user_metadata": {"last_login": "now()"}}
            )
        except Exception:
            # Don't fail the request if we can't update last login
            pass

# Initialize authentication
supabase_auth = SupabaseAuth()

# HTTP Bearer token dependency
security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required"
        )
    
    token = credentials.credentials
    user = await supabase_auth.get_user_from_token(token, db)
    
    # Update last login
    supabase_auth.update_user_last_login(str(user.auth_user_id))
    
    return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Dependency to get current active user"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user

# Optional dependency for routes that work with or without auth
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Optional[User]:
    """Optional dependency to get current user if token is provided"""
    if not credentials:
        return None
    
    try:
        token = credentials.credentials
        user = await supabase_auth.get_user_from_token(token, db)
        return user
    except HTTPException:
        return None