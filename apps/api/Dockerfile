# ================================================
# FastAPI Backend Dockerfile
# ================================================

FROM python:3.11-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gdal-bin \
    libgdal-dev \
    libproj-dev \
    libgeos-dev \
    libspatialindex-dev \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set Python environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    GDAL_CONFIG=/usr/bin/gdal-config

WORKDIR /app

# Install Python dependencies
COPY apps/api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base as development

# Install development dependencies
COPY apps/api/requirements-dev.txt /app/requirements-dev.txt
RUN pip install --no-cache-dir -r requirements-dev.txt

# Copy source code
COPY apps/api /app
COPY packages/shared /shared

# Create non-root user
RUN groupadd -r bbf && useradd -r -g bbf bbf
RUN chown -R bbf:bbf /app
USER bbf

EXPOSE 8000

# Default command for development
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage
FROM base as production

# Copy source code
COPY apps/api /app
COPY packages/shared /shared

# Create non-root user
RUN groupadd -r bbf && useradd -r -g bbf bbf
RUN chown -R bbf:bbf /app
USER bbf

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]