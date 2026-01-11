"""
Health check endpoints.
Provides system status and readiness checks.
"""
from fastapi import APIRouter, Depends
import torch

from app.config import Settings, get_settings
from app.models.yolo_model import get_model
from app.models.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=HealthResponse,
    summary="Health Check",
    description="Check if the API is running and ready to accept requests"
)
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """
    Perform health check on the API.
    
    Returns status information including:
    - API status
    - Model loading status
    - GPU availability
    - Version information
    """
    model = get_model()
    
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        model_loaded=model.is_loaded,
        gpu_available=torch.cuda.is_available()
    )


@router.get(
    "/ready",
    response_model=dict,
    summary="Readiness Check",
    description="Check if the API is ready to process requests (model loaded)"
)
async def readiness_check() -> dict:
    """
    Check if the API is ready to process detection requests.
    Returns 200 if model is loaded, 503 otherwise.
    """
    model = get_model()
    
    if not model.is_loaded:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Model not loaded yet")
    
    return {
        "status": "ready",
        "model_info": model.model_info
    }
