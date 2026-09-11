# NeuroSpeech Rehab - Production Cloud Container
# Compatible with: Render, Koyeb, Hugging Face Spaces, Fly.io, Railway
FROM python:3.11-slim

WORKDIR /app

# Install runtime system packages for audio processing (libsndfile, ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Optimize PyTorch CPU build to minimize container size (<500MB)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu

# Install backend production dependencies
COPY backend/requirements-prod.txt /app/requirements-prod.txt
RUN pip install --no-cache-dir -r /app/requirements-prod.txt

# Copy entire backend source code
COPY backend /app/backend

# Configure Python path and production environment variables
ENV PYTHONPATH="/app/backend:${PYTHONPATH}"
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production
ENV PORT=8000

EXPOSE 8000

# Container healthcheck for cloud uptime monitors
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import os, urllib.request; p = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{p}/health')" || exit 1

# Start Uvicorn bound to dynamic cloud port (PORT env var supplied by host)
CMD ["sh", "-c", "uvicorn app.main:app --app-dir /app/backend --host 0.0.0.0 --port ${PORT:-8000}"]
