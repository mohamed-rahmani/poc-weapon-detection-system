"""
Logging configuration for the Weapon Detection API.
Provides structured logging with file and console handlers.
"""
import logging
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime


def setup_logging(
    log_level: str = "INFO",
    log_format: Optional[str] = None,
    log_dir: Optional[Path] = None
) -> logging.Logger:
    """
    Setup application logging with both file and console handlers.
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Custom log format string
        log_dir: Directory to store log files
    
    Returns:
        Configured logger instance
    """
    if log_format is None:
        log_format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Create formatter
    formatter = logging.Formatter(log_format)
    
    # Get root logger
    logger = logging.getLogger("weapon_detection")
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Remove existing handlers to avoid duplicates
    logger.handlers = []
    
    # Console handler with UTF-8 encoding for Windows compatibility
    import io
    console_handler = logging.StreamHandler(io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace'))
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler with UTF-8 encoding (if log directory is provided)
    if log_dir:
        log_dir.mkdir(exist_ok=True, parents=True)
        log_file = log_dir / f"weapon_detection_{datetime.now().strftime('%Y%m%d')}.log"
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance for a specific module.
    
    Args:
        name: Module name for the logger
    
    Returns:
        Logger instance
    """
    return logging.getLogger(f"weapon_detection.{name}")
