"""
Custom exceptions for the Weapon Detection API.
Provides structured error handling across the application.
"""
from typing import Any, Dict, Optional


class WeaponDetectionException(Exception):
    """Base exception for all application errors."""
    
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class ModelLoadException(WeaponDetectionException):
    """Raised when the YOLO model fails to load."""
    
    def __init__(self, message: str = "Failed to load YOLO model", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)


class InvalidImageException(WeaponDetectionException):
    """Raised when an invalid image is provided."""
    
    def __init__(self, message: str = "Invalid image format or corrupted file", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=400, details=details)


class ImageTooLargeException(WeaponDetectionException):
    """Raised when an image exceeds the maximum allowed size."""
    
    def __init__(self, message: str = "Image size exceeds maximum allowed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=413, details=details)


class DetectionException(WeaponDetectionException):
    """Raised when detection fails."""
    
    def __init__(self, message: str = "Detection failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)


class VideoStreamException(WeaponDetectionException):
    """Raised when video stream processing fails."""
    
    def __init__(self, message: str = "Video stream processing failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=500, details=details)


class CameraNotFoundException(WeaponDetectionException):
    """Raised when camera device is not found."""
    
    def __init__(self, message: str = "Camera device not found", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, status_code=404, details=details)
