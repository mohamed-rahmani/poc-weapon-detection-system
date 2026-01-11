"""
Main FastAPI application.
Enterprise-grade weapon detection API with professional architecture.
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import time

from app.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.exceptions import WeaponDetectionException
from app.models.yolo_model import get_model
from app.api.routes import detection, health

# Initialize settings
settings = get_settings()

# Setup logging
setup_logging(
    log_level=settings.log_level,
    log_format=settings.log_format,
    log_dir=settings.logs_dir
)
logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("=" * 80)
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info("=" * 80)
    
    try:
        # Load YOLO model
        logger.info("Loading YOLO model...")
        model = get_model()
        model.load_model(settings)
        logger.info("[OK] Model loaded successfully")
        
        logger.info(f"[OK] Device: {model.device}")
        logger.info(f"[OK] Model path: {settings.model_path}")
        logger.info(f"[OK] Confidence threshold: {settings.confidence_threshold}")
        logger.info("=" * 80)
        logger.info("API is ready to accept requests!")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Failed to initialize application: {str(e)}", exc_info=True)
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")
    logger.info("Cleanup completed")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    description=settings.app_description,
    version=settings.app_version,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=settings.allowed_methods,
    allow_headers=settings.allowed_headers,
    expose_headers=["X-Detection-Count", "X-Weapon-Count", "X-Inference-Time", "X-Has-Weapons", "X-Image-Size", "X-Process-Time"],
)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add request processing time to response headers."""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    return response


# Global exception handler
@app.exception_handler(WeaponDetectionException)
async def weapon_detection_exception_handler(request: Request, exc: WeaponDetectionException):
    """Handle custom application exceptions."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.message,
            "details": exc.details,
            "path": str(request.url)
        }
    )


# Include routers
app.include_router(health.router)
app.include_router(detection.router)


# Root endpoint
@app.get(
    "/",
    tags=["Root"],
    summary="API Root",
    description="Get API information and available endpoints"
)
async def root():
    """
    Welcome endpoint with API information.
    """
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "description": settings.app_description,
        "docs": "/docs",
        "redoc": "/redoc",
        "health": "/health",
        "endpoints": {
            "image_detection": "/detect/image",
            "video_stream": "/detect/stream",
            "camera_frame": "/detect/camera/frame"
        },
        "status": "operational"
    }


if __name__ == "__main__":
    import uvicorn
    
    # Run with uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=settings.workers,
        log_level=settings.log_level.lower()
    )
