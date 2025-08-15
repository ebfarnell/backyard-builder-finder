import os
import logging
import math
from typing import List, Dict, Any, Optional
import aiohttp
from PIL import Image
import io

logger = logging.getLogger(__name__)

class ImageFetcher:
    def __init__(self):
        self.naip_template = os.getenv('NAIP_TEMPLATE_URL', 
            'https://naip-analytic.s3-us-west-2.amazonaws.com/naip/{z}/{x}/{y}.jpg')
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create HTTP session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session
    
    async def fetch_parcel_imagery(
        self, 
        bounds: Dict[str, float], 
        parcel_id: str
    ) -> List[Dict[str, Any]]:
        """Fetch imagery tiles for a parcel"""
        try:
            # Calculate appropriate zoom level based on parcel size
            zoom = self._calculate_zoom_level(bounds)
            
            # Get tile coordinates that cover the parcel
            tiles = self._get_covering_tiles(bounds, zoom)
            
            logger.info(f"Fetching {len(tiles)} tiles at zoom {zoom} for parcel {parcel_id}")
            
            # Fetch all tiles
            image_tiles = []
            session = await self._get_session()
            
            for tile in tiles:
                try:
                    tile_url = self.naip_template.format(
                        z=tile['z'], 
                        x=tile['x'], 
                        y=tile['y']
                    )
                    
                    async with session.get(tile_url) as response:
                        if response.status == 200:
                            image_data = await response.read()
                            image = Image.open(io.BytesIO(image_data))
                            
                            image_tiles.append({
                                'tile': tile,
                                'image_data': image,
                                'url': tile_url,
                                'bounds': self._tile_to_bounds(tile['x'], tile['y'], tile['z'])
                            })
                        else:
                            logger.warning(f"Failed to fetch tile {tile}: HTTP {response.status}")
                            
                except Exception as e:
                    logger.warning(f"Error fetching tile {tile}: {e}")
                    continue
            
            logger.info(f"Successfully fetched {len(image_tiles)} tiles for parcel {parcel_id}")
            return image_tiles
            
        except Exception as e:
            logger.error(f"Failed to fetch imagery for parcel {parcel_id}: {e}")
            return []
    
    def _calculate_zoom_level(self, bounds: Dict[str, float]) -> int:
        """Calculate appropriate zoom level for the parcel size"""
        # Calculate parcel dimensions in degrees
        lng_span = bounds['maxLng'] - bounds['minLng']
        lat_span = bounds['maxLat'] - bounds['minLat']
        
        # Use the larger dimension to determine zoom
        max_span = max(lng_span, lat_span)
        
        # Zoom levels for different spans (approximate)
        # We want enough resolution to detect pools (~0.3-0.6m/pixel)
        if max_span > 0.01:  # Very large parcels
            return 16
        elif max_span > 0.005:  # Large parcels
            return 17
        elif max_span > 0.002:  # Medium parcels
            return 18
        else:  # Small parcels
            return 19
    
    def _get_covering_tiles(
        self, 
        bounds: Dict[str, float], 
        zoom: int
    ) -> List[Dict[str, int]]:
        """Get tile coordinates that cover the given bounds"""
        # Convert bounds to tile coordinates
        min_tile_x = self._lng_to_tile_x(bounds['minLng'], zoom)
        max_tile_x = self._lng_to_tile_x(bounds['maxLng'], zoom)
        min_tile_y = self._lat_to_tile_y(bounds['maxLat'], zoom)  # Note: Y is flipped
        max_tile_y = self._lat_to_tile_y(bounds['minLat'], zoom)
        
        tiles = []
        for x in range(min_tile_x, max_tile_x + 1):
            for y in range(min_tile_y, max_tile_y + 1):
                tiles.append({'x': x, 'y': y, 'z': zoom})
        
        return tiles
    
    def _lng_to_tile_x(self, lng: float, zoom: int) -> int:
        """Convert longitude to tile X coordinate"""
        return int((lng + 180.0) / 360.0 * (1 << zoom))
    
    def _lat_to_tile_y(self, lat: float, zoom: int) -> int:
        """Convert latitude to tile Y coordinate"""
        lat_rad = math.radians(lat)
        return int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * (1 << zoom))
    
    def _tile_to_bounds(self, x: int, y: int, z: int) -> Dict[str, float]:
        """Convert tile coordinates to geographic bounds"""
        n = 1 << z
        min_lng = x / n * 360.0 - 180.0
        max_lng = (x + 1) / n * 360.0 - 180.0
        min_lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n)))
        max_lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
        min_lat = math.degrees(min_lat_rad)
        max_lat = math.degrees(max_lat_rad)
        
        return {
            'minLng': min_lng,
            'maxLng': max_lng,
            'minLat': min_lat,
            'maxLat': max_lat
        }
    
    async def close(self):
        """Close HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()