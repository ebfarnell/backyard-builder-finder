"""Utility endpoints for geocoding and helper functions."""

from typing import Dict, List, Tuple

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.logging import get_logger
from ..database import get_async_db

logger = get_logger(__name__)
router = APIRouter()


class GeocodeRequest(BaseModel):
    address: str


class ReverseGeocodeRequest(BaseModel):
    coordinates: List[float]  # [longitude, latitude]


@router.post("/geocode")
async def geocode_address(
    request: GeocodeRequest,
    db: AsyncSession = Depends(get_async_db)
) -> Dict:
    """Geocode an address to coordinates and bounds."""
    
    logger.info("Geocoding address", address=request.address)
    
    # TODO: Implement actual geocoding with Nominatim
    # For now, return mock results for common addresses
    
    if "los angeles" in request.address.lower():
        return {
            "success": True,
            "data": {
                "candidates": [
                    {
                        "address": "Los Angeles, CA, USA",
                        "coordinates": [-118.2437, 34.0522],
                        "confidence": 0.95,
                        "bounds": {
                            "north": 34.3373,
                            "south": 33.7037,
                            "east": -118.1553,
                            "west": -118.6681
                        }
                    }
                ]
            }
        }
    
    return {
        "success": False,
        "error": "Address not found in development mode"
    }


@router.post("/reverse-geocode")
async def reverse_geocode(
    request: ReverseGeocodeRequest,
    db: AsyncSession = Depends(get_async_db)
) -> Dict:
    """Reverse geocode coordinates to address components."""
    
    lng, lat = request.coordinates
    logger.info("Reverse geocoding", coordinates=request.coordinates)
    
    # TODO: Implement actual reverse geocoding
    
    return {
        "success": True,
        "data": {
            "address": "Sample Address",
            "city": "Los Angeles",
            "county": "Los Angeles County", 
            "state": "California",
            "zip": "90210"
        }
    }