"""
Configuration module for the Weapon Detection API.
Centralized settings management using Pydantic.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    """Application settings with validation."""
    
    # API Settings
    app_name: str = "Weapon Detection API"
    app_version: str = "1.0.0"
    app_description: str = "Professional API for real-time weapon detection using YOLOv8"
    debug: bool = False
    
    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1  # Use 1 worker to avoid model duplication on GPU
    
    # CORS Settings
    allowed_origins: List[str] = ["*"]  # Configure properly for production
    allowed_methods: List[str] = ["*"]
    allowed_headers: List[str] = ["*"]
    
    # Model Settings
    model_path: str = "best.pt"
    confidence_threshold: float = 0.4
    iou_threshold: float = 0.45
    max_detections: int = 100
    
    # GPU Settings
    device: str = "cuda"  # Use "cpu" if CUDA not available
    half_precision: bool = True  # Use FP16 for faster inference on supported GPUs
    
    # Image Processing Settings
    max_image_size: int = 10 * 1024 * 1024  # 10MB
    allowed_image_formats: List[str] = [".jpg", ".jpeg", ".png", ".bmp", ".webp"]
    
    # Video Processing Settings
    video_fps: int = 30
    video_frame_skip: int = 0  # Process every frame, increase to skip frames
    max_video_duration: int = 300  # 5 minutes max for video processing
    
    # Logging Settings
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Project Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    runs_dir: Path = base_dir / "runs"
    logs_dir: Path = base_dir / "logs"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Create directories if they don't exist
        self.runs_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Using lru_cache ensures a single settings instance across the application.
    """
    return Settings()
