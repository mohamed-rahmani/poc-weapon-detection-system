"""
Detection endpoints for weapon detection.
Provides image and video stream detection capabilities.
"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional
import json

from app.api.dependencies import get_detection_service
from app.services.detection_service import DetectionService
from app.models.schemas import (
    ImageDetectionResponse,
    VideoStreamConfig,
    VideoFrameDetection,
    ErrorResponse
)
from app.core.exceptions import (
    WeaponDetectionException,
    InvalidImageException,
    ImageTooLargeException
)
from app.utils.image_processing import validate_image_format
from app.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger("detection_routes")

router = APIRouter(prefix="/detect", tags=["Detection"])


@router.post(
    "/image",
    response_model=ImageDetectionResponse,
    summary="Detect Weapons in Image",
    description="Upload an image and get weapon detection results with bounding boxes",
    responses={
        200: {"description": "Detection successful"},
        400: {"model": ErrorResponse, "description": "Invalid image format or corrupted file"},
        413: {"model": ErrorResponse, "description": "Image size exceeds maximum allowed"},
        500: {"model": ErrorResponse, "description": "Detection failed"}
    }
)
async def detect_image(
    file: UploadFile = File(..., description="Image file to analyze"),
    confidence_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections (overrides default)"
    ),
    save_result: bool = Query(
        False,
        description="Save annotated image to disk"
    ),
    settings: Settings = Depends(get_settings),
    detection_service: DetectionService = Depends(get_detection_service)
) -> ImageDetectionResponse:
    """
    Detect weapons in an uploaded image.
    
    **Workflow:**
    1. Upload an image file (JPEG, PNG, BMP, WebP)
    2. API processes the image with YOLO model
    3. Returns detected weapons with bounding boxes and confidence scores
    
    **Use Cases:**
    - Security screening
    - Threat assessment
    - Evidence analysis
    - Mobile/web app integration
    
    **Performance:**
    - Average inference time: 30-50ms (GPU)
    - Max image size: 10MB
    - Supported formats: JPG, JPEG, PNG, BMP, WEBP
    """
    try:
        # Validate file format
        if not validate_image_format(file.filename, settings.allowed_image_formats):
            raise InvalidImageException(
                f"Invalid image format. Supported formats: {', '.join(settings.allowed_image_formats)}",
                details={"filename": file.filename}
            )
        
        # Read image data
        image_data = await file.read()
        
        # Perform detection
        result = await detection_service.detect_from_image_file(
            image_data=image_data,
            confidence_threshold=confidence_threshold,
            save_result=save_result
        )
        
        logger.info(
            f"Image detection completed: {file.filename} - "
            f"{result.detection_count} detections in {result.inference_time_ms}ms"
        )
        
        return result
        
    except WeaponDetectionException as e:
        logger.error(f"Detection error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "details": {"message": str(e)}
            }
        )


@router.post(
    "/image/annotated",
    summary="Detect Weapons and Return Annotated Image",
    description="Upload an image and get back the annotated image with bounding boxes drawn by YOLO",
    responses={
        200: {
            "description": "Annotated image with detection metadata in headers",
            "content": {"image/jpeg": {"schema": {"type": "string", "format": "binary"}}}
        },
        400: {"model": ErrorResponse, "description": "Invalid image format or corrupted file"},
        413: {"model": ErrorResponse, "description": "Image size exceeds maximum allowed"},
        500: {"model": ErrorResponse, "description": "Detection failed"}
    }
)
async def detect_image_annotated(
    file: UploadFile = File(..., description="Image file to analyze"),
    confidence_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections (overrides default)"
    ),
    settings: Settings = Depends(get_settings),
    detection_service: DetectionService = Depends(get_detection_service)
):
    """
    Detect weapons in an uploaded image and return the annotated image.
    
    **Workflow:**
    1. Upload an image file (JPEG, PNG, BMP, WebP)
    2. API processes the image with YOLO model
    3. Returns annotated JPEG image with bounding boxes drawn
    4. Detection metadata included in response headers
    
    **Response Headers:**
    - X-Detection-Count: Number of detections
    - X-Inference-Time: Inference time in milliseconds
    - X-Has-Weapons: Whether weapons were detected
    - X-Image-Size: Original image dimensions
    
    **Use Cases:**
    - Visual verification of detections
    - Display annotated results to users
    - Save annotated images for reports
    - Integration with web/mobile apps
    """
    try:
        # Validate file format
        if not validate_image_format(file.filename, settings.allowed_image_formats):
            raise InvalidImageException(
                f"Invalid image format. Supported formats: {', '.join(settings.allowed_image_formats)}",
                details={"filename": file.filename}
            )
        
        # Read image data
        image_data = await file.read()
        
        # Perform detection and get annotated image
        annotated_bytes, result = await detection_service.detect_and_annotate_image(
            image_data=image_data,
            confidence_threshold=confidence_threshold
        )
        
        logger.info(
            f"Annotated image detection completed: {file.filename} - "
            f"{result.detection_count} detections in {result.inference_time_ms}ms"
        )
        
        # Since this is a weapon detection model, all detections are weapons
        weapon_count = result.detection_count
        
        # Create response with metadata headers
        from fastapi import Response
        response = Response(
            content=annotated_bytes,
            media_type="image/jpeg",
            headers={
                "X-Detection-Count": str(result.detection_count),
                "X-Weapon-Count": str(weapon_count),
                "X-Inference-Time": f"{result.inference_time_ms}ms",
                "X-Has-Weapons": str(result.has_weapons).lower(),
                "X-Image-Size": f"{result.image_size[0]}x{result.image_size[1]}"
            }
        )
        
        return response
        
    except WeaponDetectionException as e:
        logger.error(f"Detection error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "details": {"message": str(e)}
            }
        )


@router.get(
    "/stream",
    summary="Stream Video Detection",
    description="Real-time weapon detection from camera with continuous streaming",
    responses={
        200: {
            "description": "Video stream with detections",
            "content": {
                "multipart/x-mixed-replace": {
                    "schema": {"type": "string", "format": "binary"}
                }
            }
        },
        404: {"model": ErrorResponse, "description": "Camera not found"},
        500: {"model": ErrorResponse, "description": "Stream processing failed"}
    }
)
async def detect_video_stream(
    camera_id: int = Query(0, ge=0, description="Camera device ID (0 for default webcam)"),
    confidence_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold for detections"
    ),
    frame_skip: int = Query(
        0,
        ge=0,
        le=10,
        description="Number of frames to skip between detections (0 = process all)"
    ),
    detection_service: DetectionService = Depends(get_detection_service)
):
    """
    Stream real-time weapon detection from a camera.
    
    **Workflow:**
    1. Connect to specified camera device
    2. Continuously capture and process frames
    3. Stream annotated frames with detection overlays
    
    **Use Cases:**
    - Live security monitoring
    - Real-time threat detection
    - Surveillance systems
    - Mobile camera integration
    
    **Stream Format:**
    - Content-Type: multipart/x-mixed-replace
    - Each frame is a JPEG image with bounding boxes
    - Includes detection metadata in frame headers
    
    **Performance Tips:**
    - Use frame_skip to reduce processing load
    - Lower confidence_threshold for more detections
    - Monitor inference_time for performance
    """
    try:
        async def frame_generator():
            """Generate video frames with detections."""
            try:
                for frame_bytes, detection_result in detection_service.generate_video_stream(
                    camera_id=camera_id,
                    confidence_threshold=confidence_threshold,
                    frame_skip=frame_skip
                ):
                    # Create multipart response with detection metadata
                    yield (
                        b'--frame\r\n'
                        b'Content-Type: image/jpeg\r\n'
                        b'X-Detection-Count: ' + str(detection_result.detection_count).encode() + b'\r\n'
                        b'X-Inference-Time: ' + str(detection_result.inference_time_ms).encode() + b'ms\r\n'
                        b'X-Has-Weapons: ' + str(detection_result.has_weapons).lower().encode() + b'\r\n'
                        b'\r\n' + frame_bytes + b'\r\n'
                    )
                    
            except Exception as e:
                logger.error(f"Stream generation error: {str(e)}")
                raise
        
        return StreamingResponse(
            frame_generator(),
            media_type="multipart/x-mixed-replace; boundary=frame"
        )
        
    except WeaponDetectionException as e:
        logger.error(f"Stream error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected stream error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Stream failed",
                "details": {"message": str(e)}
            }
        )


@router.post(
    "/camera/frame",
    response_model=VideoFrameDetection,
    summary="Detect Weapons in Single Camera Frame",
    description="Capture and analyze a single frame from camera",
    responses={
        200: {"description": "Detection successful"},
        404: {"model": ErrorResponse, "description": "Camera not found"},
        500: {"model": ErrorResponse, "description": "Detection failed"}
    }
)
async def detect_camera_frame(
    camera_id: int = Query(0, ge=0, description="Camera device ID"),
    confidence_threshold: Optional[float] = Query(
        None,
        ge=0.0,
        le=1.0,
        description="Minimum confidence threshold"
    ),
    detection_service: DetectionService = Depends(get_detection_service)
) -> VideoFrameDetection:
    """
    Capture and analyze a single frame from camera.
    
    **Workflow:**
    1. Connect to specified camera
    2. Capture single frame
    3. Perform detection
    4. Return results (no streaming)
    
    **Use Cases:**
    - Snapshot-based detection
    - Testing camera connectivity
    - Lower bandwidth requirements
    - REST API integration
    
    **Difference from /stream:**
    - Single frame vs continuous stream
    - JSON response vs multipart stream
    - Simpler integration for mobile/web
    """
    try:
        _, detection_result = await detection_service.detect_from_camera(
            camera_id=camera_id,
            confidence_threshold=confidence_threshold
        )
        
        logger.info(
            f"Camera frame detection: camera {camera_id} - "
            f"{detection_result.detection_count} detections"
        )
        
        return detection_result
        
    except WeaponDetectionException as e:
        logger.error(f"Camera detection error: {e.message}")
        raise HTTPException(
            status_code=e.status_code,
            detail={
                "error": e.message,
                "details": e.details
            }
        )
    except Exception as e:
        logger.error(f"Unexpected camera error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Camera detection failed",
                "details": {"message": str(e)}
            }
        )
