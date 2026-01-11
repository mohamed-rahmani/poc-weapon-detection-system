"""
Image processing utilities.
Helper functions for image validation and manipulation.
"""
from typing import Tuple, List
from pathlib import Path
import mimetypes


def validate_image_format(filename: str, allowed_formats: List[str]) -> bool:
    """
    Validate if file has an allowed image format.
    
    Args:
        filename: Name of the file to validate
        allowed_formats: List of allowed file extensions (e.g., ['.jpg', '.png'])
        
    Returns:
        True if format is valid, False otherwise
    """
    file_ext = Path(filename).suffix.lower()
    return file_ext in allowed_formats


def get_mime_type(filename: str) -> str:
    """
    Get MIME type for a file.
    
    Args:
        filename: Name of the file
        
    Returns:
        MIME type string
    """
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def validate_image_dimensions(width: int, height: int, max_dimension: int = 10000) -> bool:
    """
    Validate image dimensions.
    
    Args:
        width: Image width
        height: Image height
        max_dimension: Maximum allowed dimension
        
    Returns:
        True if dimensions are valid, False otherwise
    """
    return 0 < width <= max_dimension and 0 < height <= max_dimension


def calculate_iou(box1: Tuple[float, float, float, float], 
                  box2: Tuple[float, float, float, float]) -> float:
    """
    Calculate Intersection over Union (IoU) between two bounding boxes.
    
    Args:
        box1: First box coordinates (x1, y1, x2, y2)
        box2: Second box coordinates (x1, y1, x2, y2)
        
    Returns:
        IoU value between 0 and 1
    """
    x1_inter = max(box1[0], box2[0])
    y1_inter = max(box1[1], box2[1])
    x2_inter = min(box1[2], box2[2])
    y2_inter = min(box1[3], box2[3])
    
    if x2_inter < x1_inter or y2_inter < y1_inter:
        return 0.0
    
    inter_area = (x2_inter - x1_inter) * (y2_inter - y1_inter)
    
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    union_area = box1_area + box2_area - inter_area
    
    if union_area == 0:
        return 0.0
    
    return inter_area / union_area
