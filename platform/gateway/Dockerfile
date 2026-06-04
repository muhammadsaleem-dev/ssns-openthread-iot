# ============================================================
# Dockerfile — Smart Monitoring Gateway
# ============================================================

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first (layer caching)
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ccze && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Non-root user for security
RUN useradd -r -s /bin/false appuser && \
    chown -R appuser:appuser /app
USER appuser

# Unbuffered output for real-time Docker logs
ENV PYTHONUNBUFFERED=1

# Expose CoAP UDP port
EXPOSE 5683/udp

CMD ["python", "main.py"]