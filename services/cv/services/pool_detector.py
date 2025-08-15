import os
import logging
from typing import List, Dict, Any, Optional
import numpy as np
import cv2
from ultralytics import YOLO
from PIL import Image
import torch

logger = logging.getLogger(__name__)

class PoolDetector:
    def __init__(self):
        self.model: Optional[YOLO] = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f"Pool detector will use device: {self.device}")
    
    async def initialize(self):
        """Initialize the YOLO model"""
        try:
            # Use YOLOv8n pre-trained model
            # In production, you might fine-tune this on pool-specific data
            model_path = os.getenv('YOLO_MODEL_PATH', 'yolov8n.pt')
            
            logger.info(f"Loading YOLO model from {model_path}")
            self.model = YOLO(model_path)
            
            # Warm up the model
            dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
            _ = self.model(dummy_image, verbose=False)
            
            logger.info("YOLO model loaded and warmed up successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize YOLO model: {e}")
            raise
    
    def is_loaded(self) -> bool:
        """Check if model is loaded"""
        return self.model is not None
    
    async def detect_pools(
        self, 
        image_tiles: List[Dict[str, Any]], 
        bounds: Dict[str, float],
        parcel_geometry: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Detect pools in the provided image tiles"""
        if not self.model:
            raise RuntimeError("Model not initialized")
        
        try:
            # Stitch tiles into a single image
            stitched_image = self._stitch_tiles(image_tiles, bounds)
            
            if stitched_image is None:
                return []
            
            # Run YOLO detection
            results = self.model(stitched_image, verbose=False)
            
            # Filter and process detections
            pool_detections = []
            
            for result in results:
                boxes = result.boxes
                if boxes is not None:
                    for box in boxes:
                        # Get class and confidence
                        cls = int(box.cls[0])
                        conf = float(box.conf[0])
                        
                        # Filter for pool-like objects (you may need to adjust class IDs)
                        # YOLOv8 classes: 0=person, 1=bicycle, etc.
                        # For pools, we might look for certain classes or train custom model
                        if self._is_pool_like_object(cls, conf):
                            # Convert bounding box to geographic coordinates
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            pool_geometry = self._bbox_to_geometry(
                                x1, y1, x2, y2, 
                                stitched_image.shape, 
                                bounds
                            )
                            
                            # Check if pool overlaps with parcel
                            if self._geometry_overlaps_parcel(pool_geometry, parcel_geometry):
                                pool_detections.append({
                                    'geometry': pool_geometry,
                                    'confidence': conf,
                                    'class_id': cls,
                                })
            
            # Apply Non-Maximum Suppression to remove duplicate detections
            pool_detections = self._apply_nms(pool_detections)
            
            logger.info(f"Detected {len(pool_detections)} pools")
            return pool_detections
            
        except Exception as e:
            logger.error(f"Pool detection failed: {e}")
            return []
    
    def _stitch_tiles(
        self, 
        image_tiles: List[Dict[str, Any]], 
        bounds: Dict[str, float]
    ) -> Optional[np.ndarray]:
        """Stitch image tiles into a single image"""
        if not image_tiles:
            return None
        
        try:
            # For simplicity, we'll use the first tile
            # In production, you'd implement proper tile stitching
            first_tile = image_tiles[0]
            
            if 'image_data' in first_tile:
                # Convert PIL Image to numpy array
                if isinstance(first_tile['image_data'], Image.Image):
                    return np.array(first_tile['image_data'])
                elif isinstance(first_tile['image_data'], np.ndarray):
                    return first_tile['image_data']
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to stitch tiles: {e}")
            return None
    
    def _is_pool_like_object(self, class_id: int, confidence: float) -> bool:
        """Determine if detected object could be a pool"""
        # Minimum confidence threshold
        if confidence < 0.3:
            return False
        
        # In a pre-trained COCO model, there's no specific "pool" class
        # We might look for objects that could be pools:
        # - Large rectangular/circular objects
        # - Blue-ish objects (would need color analysis)
        # - Objects in typical pool locations (backyards)
        
        # For this demo, we'll use a heuristic approach
        # In production, you'd train a custom model on pool imagery
        
        # COCO classes that might indicate pools or pool-like structures:
        # 67: dining table (rectangular, might be confused with rectangular pools)
        # 72: tv (rectangular)
        # Or we might use any high-confidence detection and do additional filtering
        
        pool_like_classes = [67, 72]  # Placeholder - adjust based on your data
        
        return class_id in pool_like_classes or confidence > 0.7
    
    def _bbox_to_geometry(
        self, 
        x1: float, y1: float, x2: float, y2: float,
        image_shape: tuple,
        bounds: Dict[str, float]
    ) -> Dict[str, Any]:
        """Convert bounding box to geographic polygon"""
        height, width = image_shape[:2]
        
        # Convert pixel coordinates to geographic coordinates
        lng_per_pixel = (bounds['maxLng'] - bounds['minLng']) / width
        lat_per_pixel = (bounds['maxLat'] - bounds['minLat']) / height
        
        min_lng = bounds['minLng'] + x1 * lng_per_pixel
        max_lng = bounds['minLng'] + x2 * lng_per_pixel
        min_lat = bounds['maxLat'] - y2 * lat_per_pixel  # Y is flipped in images
        max_lat = bounds['maxLat'] - y1 * lat_per_pixel
        
        # Create a rectangular polygon
        return {
            'type': 'Polygon',
            'coordinates': [[
                [min_lng, min_lat],
                [max_lng, min_lat],
                [max_lng, max_lat],
                [min_lng, max_lat],
                [min_lng, min_lat]
            ]]
        }
    
    def _geometry_overlaps_parcel(
        self, 
        pool_geometry: Dict[str, Any], 
        parcel_geometry: Dict[str, Any]
    ) -> bool:
        """Check if pool geometry overlaps with parcel geometry"""
        # Simplified overlap check using bounding boxes
        # In production, use proper geometric intersection
        
        pool_coords = pool_geometry['coordinates'][0]
        pool_lngs = [coord[0] for coord in pool_coords]
        pool_lats = [coord[1] for coord in pool_coords]
        
        parcel_coords = parcel_geometry['coordinates'][0]
        parcel_lngs = [coord[0] for coord in parcel_coords]
        parcel_lats = [coord[1] for coord in parcel_coords]
        
        # Check if bounding boxes overlap
        pool_min_lng, pool_max_lng = min(pool_lngs), max(pool_lngs)
        pool_min_lat, pool_max_lat = min(pool_lats), max(pool_lats)
        
        parcel_min_lng, parcel_max_lng = min(parcel_lngs), max(parcel_lngs)
        parcel_min_lat, parcel_max_lat = min(parcel_lats), max(parcel_lats)
        
        return not (
            pool_max_lng < parcel_min_lng or
            parcel_max_lng < pool_min_lng or
            pool_max_lat < parcel_min_lat or
            parcel_max_lat < pool_min_lat
        )
    
    def _apply_nms(
        self, 
        detections: List[Dict[str, Any]], 
        iou_threshold: float = 0.5
    ) -> List[Dict[str, Any]]:
        """Apply Non-Maximum Suppression to remove duplicate detections"""
        if len(detections) <= 1:
            return detections
        
        # Sort by confidence
        detections.sort(key=lambda x: x['confidence'], reverse=True)
        
        # Simple NMS implementation
        # In production, use a more sophisticated approach
        filtered_detections = []
        
        for detection in detections:
            is_duplicate = False
            
            for existing in filtered_detections:
                # Calculate IoU (simplified)
                iou = self._calculate_geometry_iou(
                    detection['geometry'], 
                    existing['geometry']
                )
                
                if iou > iou_threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                filtered_detections.append(detection)
        
        return filtered_detections
    
    def _calculate_geometry_iou(
        self, 
        geom1: Dict[str, Any], 
        geom2: Dict[str, Any]
    ) -> float:
        """Calculate Intersection over Union for two geometries"""
        # Simplified IoU calculation using bounding boxes
        # In production, use proper geometric intersection
        
        def get_bbox(geom):
            coords = geom['coordinates'][0]
            lngs = [coord[0] for coord in coords]
            lats = [coord[1] for coord in coords]
            return {
                'min_lng': min(lngs), 'max_lng': max(lngs),
                'min_lat': min(lats), 'max_lat': max(lats)
            }
        
        bbox1 = get_bbox(geom1)
        bbox2 = get_bbox(geom2)
        
        # Calculate intersection
        inter_min_lng = max(bbox1['min_lng'], bbox2['min_lng'])
        inter_max_lng = min(bbox1['max_lng'], bbox2['max_lng'])
        inter_min_lat = max(bbox1['min_lat'], bbox2['min_lat'])
        inter_max_lat = min(bbox1['max_lat'], bbox2['max_lat'])
        
        if inter_min_lng >= inter_max_lng or inter_min_lat >= inter_max_lat:
            return 0.0
        
        inter_area = (inter_max_lng - inter_min_lng) * (inter_max_lat - inter_min_lat)
        
        # Calculate union
        area1 = (bbox1['max_lng'] - bbox1['min_lng']) * (bbox1['max_lat'] - bbox1['min_lat'])
        area2 = (bbox2['max_lng'] - bbox2['min_lng']) * (bbox2['max_lat'] - bbox2['min_lat'])
        union_area = area1 + area2 - inter_area
        
        return inter_area / union_area if union_area > 0 else 0.0