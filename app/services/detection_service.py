"""
Detection service - Business logic for weapon detection.
Separates API layer from ML model operations.
"""
from typing import List, Optional, Tuple, Any
import numpy as np
import cv2
from PIL import Image
import io
import time
from pathlib import Path

from app.models.yolo_model import get_model
from app.models.schemas import (
    Detection,
    BoundingBox,
    ImageDetectionResponse,
    VideoFrameDetection
)
from app.core.logging import get_logger
from app.core.exceptions import (
    DetectionException,
    InvalidImageException,
    ImageTooLargeException,
    CameraNotFoundException,
    VideoStreamException
)
from app.config import Settings

logger = get_logger("detection_service")


class DetectionService:
    """
    Service class for handling weapon detection operations.
    Provides high-level interface for image and video detection.
    """
    
    def __init__(self, settings: Settings):
        """
        Initialize detection service.
        
        Args:
            settings: Application settings
        """
        self.settings = settings
        self.model = get_model()
    
    def _process_results(
        self,
        results: List[Any],
        inference_time_ms: float
    ) -> Tuple[List[Detection], Tuple[int, int]]:
        """
        Process YOLO results into structured Detection objects.
        
        Args:
            results: Raw YOLO detection results
            inference_time_ms: Inference time in milliseconds
            
        Returns:
            Tuple of (detections list, image dimensions)
        """
        detections = []
        image_size = (0, 0)
        
        if not results or len(results) == 0:
            return detections, image_size
        
        result = results[0]  # Get first result
        
        # Get image dimensions
        if hasattr(result, 'orig_shape'):
            image_size = (result.orig_shape[1], result.orig_shape[0])  # (width, height)
        
        # Process detections
        if result.boxes is not None and len(result.boxes) > 0:
            boxes = result.boxes
            
            for i in range(len(boxes)):
                # Get bounding box coordinates
                xyxy = boxes.xyxy[i].cpu().numpy()
                
                # Get confidence score
                conf = float(boxes.conf[i].cpu().numpy())
                
                # Get class ID and name
                cls_id = int(boxes.cls[i].cpu().numpy())
                cls_name = result.names[cls_id] if hasattr(result, 'names') else f"class_{cls_id}"
                
                # Create detection object
                detection = Detection(
                    class_name=cls_name,
                    confidence=conf,
                    bounding_box=BoundingBox(
                        x1=float(xyxy[0]),
                        y1=float(xyxy[1]),
                        x2=float(xyxy[2]),
                        y2=float(xyxy[3])
                    ),
                    class_id=cls_id
                )
                
                detections.append(detection)
        
        return detections, image_size
    
    async def detect_from_image_file(
        self,
        image_data: bytes,
        confidence_threshold: Optional[float] = None,
        save_result: bool = False
    ) -> ImageDetectionResponse:
        """
        Perform detection on an uploaded image file.
        
        Args:
            image_data: Raw image bytes
            confidence_threshold: Custom confidence threshold
            save_result: Whether to save annotated image
            
        Returns:
            ImageDetectionResponse with detection results
            
        Raises:
            InvalidImageException: If image is invalid or corrupted
            ImageTooLargeException: If image exceeds size limit
            DetectionException: If detection fails
        """
        try:
            # Check image size
            if len(image_data) > self.settings.max_image_size:
                raise ImageTooLargeException(
                    f"Image size {len(image_data)} exceeds maximum {self.settings.max_image_size}",
                    details={"size": len(image_data), "max_size": self.settings.max_image_size}
                )
            
            # Load image
            try:
                image = Image.open(io.BytesIO(image_data))
                image_np = np.array(image)
                
                # Convert RGBA to RGB if necessary
                if image_np.shape[-1] == 4:
                    image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
                elif len(image_np.shape) == 2:  # Grayscale
                    image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
                
            except Exception as e:
                logger.error(f"Failed to load image: {str(e)}")
                raise InvalidImageException(
                    "Failed to load image. Ensure it's a valid image file.",
                    details={"error": str(e)}
                )
            
            # Use custom confidence threshold if provided
            conf = confidence_threshold if confidence_threshold is not None else self.settings.confidence_threshold
            
            # Run inference
            start_time = time.time()
            results = self.model.predict(
                source=image_np,
                conf=conf,
                save=save_result
            )
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            # Process results
            detections, image_size = self._process_results(results, inference_time)
            
            # Create response
            response = ImageDetectionResponse(
                detections=detections,
                detection_count=len(detections),
                inference_time_ms=round(inference_time, 2),
                image_size=image_size,
                has_weapons=len(detections) > 0
            )
            
            logger.info(
                f"Image detection completed: {len(detections)} objects detected in {inference_time:.2f}ms"
            )
            
            return response
            
        except (InvalidImageException, ImageTooLargeException):
            raise
        except Exception as e:
            logger.error(f"Detection failed: {str(e)}", exc_info=True)
            raise DetectionException(
                f"Detection failed: {str(e)}",
                details={"error": str(e)}
            )
    
    async def detect_and_annotate_image(
        self,
        image_data: bytes,
        confidence_threshold: Optional[float] = None
    ) -> Tuple[bytes, ImageDetectionResponse]:
        """
        Perform detection and return annotated image with detection results.
        
        Args:
            image_data: Raw image bytes
            confidence_threshold: Custom confidence threshold
            
        Returns:
            Tuple of (annotated image bytes, detection response)
            
        Raises:
            InvalidImageException: If image is invalid or corrupted
            ImageTooLargeException: If image exceeds size limit
            DetectionException: If detection fails
        """
        try:
            # Check image size
            if len(image_data) > self.settings.max_image_size:
                raise ImageTooLargeException(
                    f"Image size {len(image_data)} exceeds maximum {self.settings.max_image_size}",
                    details={"size": len(image_data), "max_size": self.settings.max_image_size}
                )
            
            # Load image
            try:
                image = Image.open(io.BytesIO(image_data))
                image_np = np.array(image)
                
                # Convert RGBA to RGB if necessary
                if image_np.shape[-1] == 4:
                    image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2RGB)
                elif len(image_np.shape) == 2:  # Grayscale
                    image_np = cv2.cvtColor(image_np, cv2.COLOR_GRAY2RGB)
                
            except Exception as e:
                logger.error(f"Failed to load image: {str(e)}")
                raise InvalidImageException(
                    "Failed to load image. Ensure it's a valid image file.",
                    details={"error": str(e)}
                )
            
            # Use custom confidence threshold if provided
            conf = confidence_threshold if confidence_threshold is not None else self.settings.confidence_threshold
            
            # Run inference
            start_time = time.time()
            results = self.model.predict(
                source=image_np,
                conf=conf,
                save=False
            )
            inference_time = (time.time() - start_time) * 1000  # Convert to milliseconds
            
            # Process results
            detections, image_size = self._process_results(results, inference_time)
            
            # Get annotated image
            annotated_image = results[0].plot() if results and len(results) > 0 else image_np
            
            # Convert annotated image to bytes (JPEG)
            _, buffer = cv2.imencode('.jpg', cv2.cvtColor(annotated_image, cv2.COLOR_RGB2BGR))
            annotated_bytes = buffer.tobytes()
            
            # Create response
            response = ImageDetectionResponse(
                detections=detections,
                detection_count=len(detections),
                inference_time_ms=round(inference_time, 2),
                image_size=image_size,
                has_weapons=len(detections) > 0
            )
            
            logger.info(
                f"Image detection with annotation completed: {len(detections)} objects detected in {inference_time:.2f}ms"
            )
            
            return annotated_bytes, response
            
        except (InvalidImageException, ImageTooLargeException):
            raise
        except Exception as e:
            logger.error(f"Detection with annotation failed: {str(e)}", exc_info=True)
            raise DetectionException(
                f"Detection with annotation failed: {str(e)}",
                details={"error": str(e)}
            )
    
    async def detect_from_camera(
        self,
        camera_id: int = 0,
        confidence_threshold: Optional[float] = None
    ) -> Tuple[np.ndarray, VideoFrameDetection]:
        """
        Perform detection on a single frame from camera.
        
        Args:
            camera_id: Camera device ID
            confidence_threshold: Custom confidence threshold
            
        Returns:
            Tuple of (frame with annotations, detection results)
            
        Raises:
            CameraNotFoundException: If camera is not accessible
            DetectionException: If detection fails
        """
        try:
            # Open camera
            cap = cv2.VideoCapture(camera_id)
            
            if not cap.isOpened():
                raise CameraNotFoundException(
                    f"Cannot access camera {camera_id}",
                    details={"camera_id": camera_id}
                )
            
            # Read frame
            ret, frame = cap.read()
            cap.release()
            
            if not ret or frame is None:
                raise VideoStreamException(
                    "Failed to capture frame from camera",
                    details={"camera_id": camera_id}
                )
            
            # Use custom confidence threshold if provided
            conf = confidence_threshold if confidence_threshold is not None else self.settings.confidence_threshold
            
            # Run inference
            start_time = time.time()
            results = self.model.predict(
                source=frame,
                conf=conf,
                save=False
            )
            inference_time = (time.time() - start_time) * 1000
            
            # Process results
            detections, _ = self._process_results(results, inference_time)
            
            # Get annotated frame
            annotated_frame = results[0].plot() if results else frame
            
            # Create response
            detection_result = VideoFrameDetection(
                frame_number=0,
                detections=detections,
                detection_count=len(detections),
                inference_time_ms=round(inference_time, 2),
                has_weapons=len(detections) > 0
            )
            
            return annotated_frame, detection_result
            
        except (CameraNotFoundException, VideoStreamException):
            raise
        except Exception as e:
            logger.error(f"Camera detection failed: {str(e)}", exc_info=True)
            raise DetectionException(
                f"Camera detection failed: {str(e)}",
                details={"error": str(e)}
            )
    
    def generate_video_stream(
        self,
        camera_id: int = 0,
        confidence_threshold: Optional[float] = None,
        frame_skip: int = 0
    ):
        """
        Generator for video stream detection.
        Yields annotated frames and detection results.
        
        Args:
            camera_id: Camera device ID
            confidence_threshold: Custom confidence threshold
            frame_skip: Number of frames to skip between detections
            
        Yields:
            Tuple of (annotated frame bytes, detection results)
            
        Raises:
            CameraNotFoundException: If camera is not accessible
            VideoStreamException: If streaming fails
        """
        cap = None
        frame_count = 0
        
        try:
            # Open camera
            cap = cv2.VideoCapture(camera_id)
            
            if not cap.isOpened():
                raise CameraNotFoundException(
                    f"Cannot access camera {camera_id}",
                    details={"camera_id": camera_id}
                )
            
            logger.info(f"Started video stream from camera {camera_id}")
            
            conf = confidence_threshold if confidence_threshold is not None else self.settings.confidence_threshold
            
            while True:
                ret, frame = cap.read()
                
                if not ret or frame is None:
                    logger.warning("Failed to read frame, ending stream")
                    break
                
                # Skip frames if configured
                if frame_count % (frame_skip + 1) != 0:
                    frame_count += 1
                    continue
                
                try:
                    # Run inference
                    start_time = time.time()
                    results = self.model.predict(
                        source=frame,
                        conf=conf,
                        save=False
                    )
                    inference_time = (time.time() - start_time) * 1000
                    
                    # Process results
                    detections, _ = self._process_results(results, inference_time)
                    
                    # Get annotated frame
                    annotated_frame = results[0].plot() if results else frame
                    
                    # Create detection result
                    detection_result = VideoFrameDetection(
                        frame_number=frame_count,
                        detections=detections,
                        detection_count=len(detections),
                        inference_time_ms=round(inference_time, 2),
                        has_weapons=len(detections) > 0
                    )
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', annotated_frame)
                    frame_bytes = buffer.tobytes()
                    
                    yield frame_bytes, detection_result
                    
                except Exception as e:
                    logger.error(f"Error processing frame {frame_count}: {str(e)}")
                    continue
                
                frame_count += 1
                
        except CameraNotFoundException:
            raise
        except Exception as e:
            logger.error(f"Video stream error: {str(e)}", exc_info=True)
            raise VideoStreamException(
                f"Video stream failed: {str(e)}",
                details={"error": str(e)}
            )
        finally:
            if cap is not None:
                cap.release()
                logger.info("Camera released")
