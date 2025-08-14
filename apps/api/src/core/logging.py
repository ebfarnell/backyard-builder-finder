"""Structured logging configuration."""

import logging
import sys
from typing import Any, Dict

import structlog

from .config import settings


def setup_logging() -> None:
    """Configure structured logging for the application."""
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper()),
    )
    
    # Configure structlog
    structlog.configure(
        processors=[
            # Add log level and timestamp
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            
            # Add request ID if available
            add_request_id,
            
            # JSON output for production, human-readable for development
            structlog.processors.JSONRenderer() if not settings.DEBUG
            else structlog.dev.ConsoleRenderer(colors=True)
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def add_request_id(logger: Any, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add request ID to log entries if available."""
    try:
        from contextvars import ContextVar
        # This would be set by middleware
        request_id_var: ContextVar[str] = ContextVar('request_id', default=None)
        request_id = request_id_var.get()
        if request_id:
            event_dict['request_id'] = request_id
    except (ImportError, LookupError):
        pass
    
    return event_dict


def get_logger(name: str = None) -> structlog.BoundLogger:
    """Get a configured logger instance."""
    return structlog.get_logger(name)


# Common logger instance
logger = get_logger(__name__)