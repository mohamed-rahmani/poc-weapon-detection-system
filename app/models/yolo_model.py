"""
YOLO model wrapper with singleton pattern.
Ensures single model instance across the application for efficient GPU memory usage.
"""
from ultralytics import YOLO
from typing import Optional, List, Any
from pathlib import Path
import torch
import threading
from app.core.logging import get_logger
from app.core.exceptions import ModelLoadException
from app.config import Settings

logger = get_logger("yolo_model")


class YOLOModelWrapper:
    """
    Singleton wrapper for YOLO model.
    Ensures only one model instance exists, preventing GPU memory duplication.
    Thread-safe implementation for concurrent requests.
    """
    
    _instance: Optional["YOLOModelWrapper"] = None
    _lock: threading.Lock = threading.Lock()
    
    def __new__(cls):
        """Implement singleton pattern with thread safety."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize YOLO model wrapper (only called once)."""
        if not hasattr(self, "_initialized"):
            self._initialized = False
            self.model: Optional[YOLO] = None
            self._settings: Optional[Settings] = None
    
    def load_model(self, settings: Settings) -> None:
        """
        Load YOLO model with specified settings.
        
        Args:
            settings: Application settings containing model configuration
            
        Raises:
            ModelLoadException: If model fails to load
        """
        if self._initialized and self.model is not None:
            logger.info("Model already loaded, skipping initialization")
            return
        
        with self._lock:
            if self._initialized and self.model is not None:
                return
            
            try:
                logger.info(f"Loading YOLO model from: {settings.model_path}")
                
                # Check if model file exists
                model_path = Path(settings.model_path)
                if not model_path.exists():
                    raise ModelLoadException(
                        f"Model file not found: {settings.model_path}",
                        details={"model_path": str(model_path.absolute())}
                    )
                
                # Load model
                self.model = YOLO(settings.model_path)
                
                # Check GPU availability
                if settings.device == "cuda":
                    if not torch.cuda.is_available():
                        logger.warning("CUDA requested but not available, falling back to CPU")
                        settings.device = "cpu"
                        settings.half_precision = False
                    else:
                        gpu_name = torch.cuda.get_device_name(0)
                        gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1e9
                        logger.info(f"GPU detected: {gpu_name} ({gpu_memory:.2f} GB)")
                
                # Move model to device
                self.model.to(settings.device)
                
                # Enable half precision if requested and supported
                if settings.half_precision and settings.device == "cuda":
                    logger.info("Enabling FP16 (half precision) mode for faster inference")
                
                self._settings = settings
                self._initialized = True
                
                # Warm up the model with a dummy inference
                logger.info("Warming up model...")
                import numpy as np
                dummy_image = np.zeros((640, 640, 3), dtype=np.uint8)
                self.model.predict(
                    dummy_image,
                    conf=settings.confidence_threshold,
                    device=settings.device,
                    half=settings.half_precision,
                    verbose=False
                )
                
                logger.info("Model loaded and warmed up successfully")
                
            except Exception as e:
                logger.error(f"Failed to load model: {str(e)}", exc_info=True)
                raise ModelLoadException(
                    f"Failed to load YOLO model: {str(e)}",
                    details={"error": str(e)}
                )
    
    def predict(
        self,
        source: Any,
        conf: Optional[float] = None,
        iou: Optional[float] = None,
        save: bool = False,
        project: Optional[str] = None,
        **kwargs
    ) -> List[Any]:
        """
        Run inference on the provided source.
        
        Args:
            source: Input source (image, video path, camera ID, etc.)
            conf: Confidence threshold (uses default if not provided)
            iou: IoU threshold for NMS (uses default if not provided)
            save: Whether to save results
            project: Project directory for saving results
            **kwargs: Additional YOLO predict parameters
            
        Returns:
            List of detection results
            
        Raises:
            ModelLoadException: If model is not loaded
        """
        if not self._initialized or self.model is None:
            raise ModelLoadException("Model not loaded. Call load_model() first.")
        
        # Use default settings if not provided
        if conf is None:
            conf = self._settings.confidence_threshold
        if iou is None:
            iou = self._settings.iou_threshold
        if project is None:
            project = str(self._settings.runs_dir)
        
        # Run inference
        results = self.model.predict(
            source=source,
            conf=conf,
            iou=iou,
            device=self._settings.device,
            half=self._settings.half_precision,
            save=save,
            project=project,
            verbose=False,
            **kwargs
        )
        
        return results
    
    def track(
        self,
        source: Any,
        conf: Optional[float] = None,
        save: bool = False,
        project: Optional[str] = None,
        **kwargs
    ) -> Any:
        """
        Run tracking on video source.
        
        Args:
            source: Video source (path, camera ID, etc.)
            conf: Confidence threshold
            save: Whether to save results
            project: Project directory for saving results
            **kwargs: Additional YOLO track parameters
            
        Returns:
            Tracking results
            
        Raises:
            ModelLoadException: If model is not loaded
        """
        if not self._initialized or self.model is None:
            raise ModelLoadException("Model not loaded. Call load_model() first.")
        
        if conf is None:
            conf = self._settings.confidence_threshold
        if project is None:
            project = str(self._settings.runs_dir)
        
        results = self.model.track(
            source=source,
            conf=conf,
            device=self._settings.device,
            half=self._settings.half_precision,
            save=save,
            project=project,
            verbose=False,
            **kwargs
        )
        
        return results
    
    @property
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._initialized and self.model is not None
    
    @property
    def device(self) -> str:
        """Get current device."""
        if self._settings:
            return self._settings.device
        return "unknown"
    
    @property
    def model_info(self) -> dict:
        """Get model information."""
        if not self.is_loaded:
            return {"loaded": False}
        
        return {
            "loaded": True,
            "device": self.device,
            "model_path": self._settings.model_path,
            "confidence_threshold": self._settings.confidence_threshold,
            "half_precision": self._settings.half_precision,
        }


# Global function to get model instance
def get_model() -> YOLOModelWrapper:
    """
    Get the singleton YOLO model instance.
    
    Returns:
        YOLOModelWrapper instance
    """
    return YOLOModelWrapper()
