import os
import time
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from .services.pool_detector import PoolDetector
from .services.image_fetcher import ImageFetcher
from .services.cache_manager import CacheManager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Sentry
if os.getenv('SENTRY_DSN_API'):
    sentry_sdk.init(
        dsn=os.getenv('SENTRY_DSN_API'),
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=os.getenv('NODE_ENV', 'development'),
    )

# Global services
pool_detector: Optional[PoolDetector] = None
image_fetcher: Optional[ImageFetcher] = None
cache_manager: Optional[CacheManager] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global pool_detector, image_fetcher, cache_manager
    
    logger.info("Initializing CV services...")
    
    pool_detector = PoolDetector()
    image_fetcher = ImageFetcher()
    cache_manager = CacheManager()
    
    await pool_detector.initialize()
    logger.info("CV services initialized successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down CV services...")

app = FastAPI(
    title="Yard Qualifier CV Service",
    description="Computer vision service for pool detection in aerial imagery",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class PoolDetectionRequest(BaseModel):
    parcelId: str
    geometry: Dict[str, Any]
    forceRefresh: bool = False

class PoolDetection(BaseModel):
    geometry: Dict[str, Any]
    confidence: float

class PoolDetectionResponse(BaseModel):
    parcelId: str
    pools: List[PoolDetection]
    processingTime: float
    cached: bool = False

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    model_loaded: bool
    cache_size: int

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        model_loaded=pool_detector is not None and pool_detector.is_loaded(),
        cache_size=cache_manager.get_cache_size() if cache_manager else 0
    )

@app.post("/cv/pool-detect", response_model=PoolDetectionResponse)
async def detect_pools(
    request: PoolDetectionRequest,
    background_tasks: BackgroundTasks
):
    """Detect pools in parcel imagery"""
    start_time = time.time()
    
    try:
        if not pool_detector or not image_fetcher or not cache_manager:
            raise HTTPException(status_code=503, detail="Services not initialized")
        
        # Check cache first (unless force refresh)
        if not request.forceRefresh:
            cached_result = await cache_manager.get_detection(request.parcelId)
            if cached_result:
                logger.info(f"Returning cached result for parcel {request.parcelId}")
                return PoolDetectionResponse(
                    parcelId=request.parcelId,
                    pools=cached_result['pools'],
                    processingTime=time.time() - start_time,
                    cached=True
                )
        
        # Get parcel bounds
        bounds = get_geometry_bounds(request.geometry)
        
        # Fetch imagery
        logger.info(f"Fetching imagery for parcel {request.parcelId}")
        image_tiles = await image_fetcher.fetch_parcel_imagery(
            bounds, 
            request.parcelId
        )
        
        if not image_tiles:
            logger.warning(f"No imagery available for parcel {request.parcelId}")
            return PoolDetectionResponse(
                parcelId=request.parcelId,
                pools=[],
                processingTime=time.time() - start_time
            )
        
        # Detect pools
        logger.info(f"Running pool detection for parcel {request.parcelId}")
        detections = await pool_detector.detect_pools(
            image_tiles, 
            bounds,
            request.geometry
        )
        
        # Convert detections to response format
        pools = []
        for detection in detections:
            pools.append(PoolDetection(
                geometry=detection['geometry'],
                confidence=detection['confidence']
            ))
        
        # Cache result in background
        background_tasks.add_task(
            cache_manager.cache_detection,
            request.parcelId,
            pools
        )
        
        processing_time = time.time() - start_time
        logger.info(f"Pool detection completed for parcel {request.parcelId} in {processing_time:.2f}s")
        
        return PoolDetectionResponse(
            parcelId=request.parcelId,
            pools=pools,
            processingTime=processing_time
        )
        
    except Exception as e:
        logger.error(f"Pool detection failed for parcel {request.parcelId}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Pool detection failed: {str(e)}")

@app.delete("/cv/cache/{parcel_id}")
async def clear_cache(parcel_id: str):
    """Clear cache for a specific parcel"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    
    await cache_manager.clear_detection(parcel_id)
    return {"message": f"Cache cleared for parcel {parcel_id}"}

@app.get("/cv/cache/stats")
async def cache_stats():
    """Get cache statistics"""
    if not cache_manager:
        raise HTTPException(status_code=503, detail="Cache manager not initialized")
    
    return {
        "size": cache_manager.get_cache_size(),
        "hit_rate": cache_manager.get_hit_rate(),
        "oldest_entry": cache_manager.get_oldest_entry(),
    }

def get_geometry_bounds(geometry: Dict[str, Any]) -> Dict[str, float]:
    """Extract bounding box from geometry"""
    if geometry['type'] != 'Polygon':
        raise ValueError("Only Polygon geometry supported")
    
    coords = geometry['coordinates'][0]
    lngs = [coord[0] for coord in coords]
    lats = [coord[1] for coord in coords]
    
    return {
        'minLng': min(lngs),
        'maxLng': max(lngs),
        'minLat': min(lats),
        'maxLat': max(lats),
    }

if __name__ == "__main__":
    port = int(os.getenv("CV_PORT", "8000"))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=os.getenv("NODE_ENV") == "development",
        log_level="info"
    )