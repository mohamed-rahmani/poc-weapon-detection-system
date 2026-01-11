"""
Dependency injection for FastAPI routes.
Provides reusable dependencies for request handling.
"""
from fastapi import Depends
from app.config import Settings, get_settings
from app.services.detection_service import DetectionService


def get_detection_service(settings: Settings = Depends(get_settings)) -> DetectionService:
    """
    Dependency to inject DetectionService into routes.
    
    Args:
        settings: Application settings
        
    Returns:
        DetectionService instance
    """
    return DetectionService(settings)
