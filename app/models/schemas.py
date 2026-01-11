"""
Pydantic schemas for request/response validation.
Ensures type safety and automatic API documentation.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Tuple
from datetime import datetime
from enum import Enum


class DetectionClass(str, Enum):
    """Enumeration of detectable weapon types."""
    WEAPON = "weapon"
    GUN = "gun"
    KNIFE = "knife"
    # Add more weapon types as needed based on your model


class BoundingBox(BaseModel):
    """Bounding box coordinates for detected objects."""
    x1: float = Field(..., description="Top-left X coordinate")
    y1: float = Field(..., description="Top-left Y coordinate")
    x2: float = Field(..., description="Bottom-right X coordinate")
    y2: float = Field(..., description="Bottom-right Y coordinate")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "x1": 100.5,
                "y1": 200.3,
                "x2": 300.7,
                "y2": 400.9
            }
        }
    )


class Detection(BaseModel):
    """Single detection result."""
    class_name: str = Field(..., description="Detected object class name")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    bounding_box: BoundingBox = Field(..., description="Bounding box coordinates")
    class_id: int = Field(..., description="Class ID from the model")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "class_name": "gun",
                "confidence": 0.92,
                "bounding_box": {
                    "x1": 100.5,
                    "y1": 200.3,
                    "x2": 300.7,
                    "y2": 400.9
                },
                "class_id": 0
            }
        }
    )


class ImageDetectionRequest(BaseModel):
    """Request schema for image detection (optional metadata)."""
    confidence_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections"
    )
    save_result: bool = Field(
        False,
        description="Whether to save annotated image"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "confidence_threshold": 0.5,
                "save_result": True
            }
        }
    )


class ImageDetectionResponse(BaseModel):
    """Response schema for image detection."""
    detections: List[Detection] = Field(..., description="List of detected objects")
    detection_count: int = Field(..., description="Total number of detections")
    inference_time_ms: float = Field(..., description="Inference time in milliseconds")
    image_size: Tuple[int, int] = Field(..., description="Original image dimensions (width, height)")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Detection timestamp")
    has_weapons: bool = Field(..., description="Whether any weapons were detected")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "detections": [
                    {
                        "class_name": "gun",
                        "confidence": 0.92,
                        "bounding_box": {
                            "x1": 100.5,
                            "y1": 200.3,
                            "x2": 300.7,
                            "y2": 400.9
                        },
                        "class_id": 0
                    }
                ],
                "detection_count": 1,
                "inference_time_ms": 45.2,
                "image_size": [1920, 1080],
                "timestamp": "2024-01-10T12:00:00Z",
                "has_weapons": True
            }
        }
    )


class VideoStreamConfig(BaseModel):
    """Configuration for video stream detection."""
    camera_id: int = Field(
        0,
        ge=0,
        description="Camera device ID (0 for default webcam)"
    )
    confidence_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections"
    )
    frame_skip: int = Field(
        0,
        ge=0,
        description="Number of frames to skip between detections"
    )
    save_frames: bool = Field(
        False,
        description="Whether to save annotated frames"
    )
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "camera_id": 0,
                "confidence_threshold": 0.5,
                "frame_skip": 2,
                "save_frames": False
            }
        }
    )


class VideoFrameDetection(BaseModel):
    """Detection result for a single video frame."""
    frame_number: int = Field(..., description="Frame sequence number")
    detections: List[Detection] = Field(..., description="List of detected objects")
    detection_count: int = Field(..., description="Total number of detections")
    inference_time_ms: float = Field(..., description="Inference time in milliseconds")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Frame timestamp")
    has_weapons: bool = Field(..., description="Whether any weapons were detected")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "frame_number": 42,
                "detections": [],
                "detection_count": 0,
                "inference_time_ms": 38.5,
                "timestamp": "2024-01-10T12:00:00Z",
                "has_weapons": False
            }
        }
    )


class HealthResponse(BaseModel):
    """Health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    model_loaded: bool = Field(..., description="Whether YOLO model is loaded")
    gpu_available: bool = Field(..., description="Whether GPU is available")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Health check timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "healthy",
                "version": "1.0.0",
                "model_loaded": True,
                "gpu_available": True,
                "timestamp": "2024-01-10T12:00:00Z"
            }
        }
    )


class ErrorResponse(BaseModel):
    """Standard error response."""
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Error timestamp")
    
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "error": "Invalid image format",
                "detail": "Supported formats: .jpg, .jpeg, .png, .bmp, .webp",
                "timestamp": "2024-01-10T12:00:00Z"
            }
        }
    )
