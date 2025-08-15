import os
import json
import time
import logging
from typing import Dict, Any, Optional, List
import aiofiles
from pathlib import Path

logger = logging.getLogger(__name__)

class CacheManager:
    def __init__(self):
        self.cache_dir = Path(os.getenv('CV_CACHE_DIR', '/tmp/cv_cache'))
        self.cache_ttl = int(os.getenv('CV_CACHE_TTL', '604800'))  # 7 days default
        self.max_cache_size = int(os.getenv('CV_MAX_CACHE_SIZE', '1000'))  # Max entries
        
        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # In-memory cache for quick access
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._cache_stats = {
            'hits': 0,
            'misses': 0,
            'total_requests': 0
        }
        
        logger.info(f"Cache manager initialized with dir: {self.cache_dir}, TTL: {self.cache_ttl}s")
    
    async def get_detection(self, parcel_id: str) -> Optional[Dict[str, Any]]:
        """Get cached detection result for a parcel"""
        self._cache_stats['total_requests'] += 1
        
        # Check memory cache first
        if parcel_id in self._memory_cache:
            cached_data = self._memory_cache[parcel_id]
            if self._is_cache_valid(cached_data['timestamp']):
                self._cache_stats['hits'] += 1
                logger.debug(f"Memory cache hit for parcel {parcel_id}")
                return cached_data['data']
            else:
                # Remove expired entry
                del self._memory_cache[parcel_id]
        
        # Check disk cache
        cache_file = self.cache_dir / f"{parcel_id}.json"
        
        try:
            if cache_file.exists():
                async with aiofiles.open(cache_file, 'r') as f:
                    content = await f.read()
                    cached_data = json.loads(content)
                
                if self._is_cache_valid(cached_data['timestamp']):
                    # Load into memory cache
                    self._memory_cache[parcel_id] = cached_data
                    self._cache_stats['hits'] += 1
                    logger.debug(f"Disk cache hit for parcel {parcel_id}")
                    return cached_data['data']
                else:
                    # Remove expired file
                    cache_file.unlink()
                    
        except Exception as e:
            logger.warning(f"Error reading cache for parcel {parcel_id}: {e}")
        
        self._cache_stats['misses'] += 1
        return None
    
    async def cache_detection(self, parcel_id: str, pools: List[Dict[str, Any]]):
        """Cache detection result for a parcel"""
        try:
            timestamp = time.time()
            cached_data = {
                'timestamp': timestamp,
                'data': {'pools': pools}
            }
            
            # Store in memory cache
            self._memory_cache[parcel_id] = cached_data
            
            # Store in disk cache
            cache_file = self.cache_dir / f"{parcel_id}.json"
            async with aiofiles.open(cache_file, 'w') as f:
                await f.write(json.dumps(cached_data))
            
            # Clean up old entries if cache is too large
            await self._cleanup_cache()
            
            logger.debug(f"Cached detection result for parcel {parcel_id}")
            
        except Exception as e:
            logger.error(f"Error caching detection for parcel {parcel_id}: {e}")
    
    async def clear_detection(self, parcel_id: str):
        """Clear cached detection for a specific parcel"""
        try:
            # Remove from memory cache
            if parcel_id in self._memory_cache:
                del self._memory_cache[parcel_id]
            
            # Remove from disk cache
            cache_file = self.cache_dir / f"{parcel_id}.json"
            if cache_file.exists():
                cache_file.unlink()
            
            logger.info(f"Cleared cache for parcel {parcel_id}")
            
        except Exception as e:
            logger.error(f"Error clearing cache for parcel {parcel_id}: {e}")
    
    def get_cache_size(self) -> int:
        """Get current cache size (number of entries)"""
        return len(self._memory_cache)
    
    def get_hit_rate(self) -> float:
        """Get cache hit rate"""
        if self._cache_stats['total_requests'] == 0:
            return 0.0
        return self._cache_stats['hits'] / self._cache_stats['total_requests']
    
    def get_oldest_entry(self) -> Optional[str]:
        """Get timestamp of oldest cache entry"""
        if not self._memory_cache:
            return None
        
        oldest_timestamp = min(
            entry['timestamp'] for entry in self._memory_cache.values()
        )
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(oldest_timestamp))
    
    def _is_cache_valid(self, timestamp: float) -> bool:
        """Check if cache entry is still valid"""
        return (time.time() - timestamp) < self.cache_ttl
    
    async def _cleanup_cache(self):
        """Clean up old cache entries"""
        try:
            # Clean up memory cache
            current_time = time.time()
            expired_keys = [
                key for key, data in self._memory_cache.items()
                if not self._is_cache_valid(data['timestamp'])
            ]
            
            for key in expired_keys:
                del self._memory_cache[key]
            
            # If still too large, remove oldest entries
            if len(self._memory_cache) > self.max_cache_size:
                sorted_entries = sorted(
                    self._memory_cache.items(),
                    key=lambda x: x[1]['timestamp']
                )
                
                entries_to_remove = len(self._memory_cache) - self.max_cache_size
                for key, _ in sorted_entries[:entries_to_remove]:
                    del self._memory_cache[key]
                    
                    # Also remove from disk
                    cache_file = self.cache_dir / f"{key}.json"
                    if cache_file.exists():
                        cache_file.unlink()
            
            # Clean up disk cache
            if self.cache_dir.exists():
                for cache_file in self.cache_dir.glob("*.json"):
                    try:
                        stat = cache_file.stat()
                        if (current_time - stat.st_mtime) > self.cache_ttl:
                            cache_file.unlink()
                    except Exception as e:
                        logger.warning(f"Error cleaning up cache file {cache_file}: {e}")
            
            logger.debug(f"Cache cleanup completed. Current size: {len(self._memory_cache)}")
            
        except Exception as e:
            logger.error(f"Error during cache cleanup: {e}")
    
    async def clear_all_cache(self):
        """Clear all cached data"""
        try:
            # Clear memory cache
            self._memory_cache.clear()
            
            # Clear disk cache
            if self.cache_dir.exists():
                for cache_file in self.cache_dir.glob("*.json"):
                    cache_file.unlink()
            
            # Reset stats
            self._cache_stats = {
                'hits': 0,
                'misses': 0,
                'total_requests': 0
            }
            
            logger.info("All cache cleared")
            
        except Exception as e:
            logger.error(f"Error clearing all cache: {e}")