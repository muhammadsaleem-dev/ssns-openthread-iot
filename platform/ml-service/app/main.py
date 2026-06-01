import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from pydantic import BaseModel

from app.core.config import settings
from app.services.poller import start_polling_loop
from app.ml.ml_engine import detector_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

polling_task = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global polling_task
    logger.info("Starting ML Analytics Service")
    polling_task = asyncio.create_task(start_polling_loop())
    yield
    logger.info("Shutting down ML Analytics Service")
    if polling_task:
        polling_task.cancel()

app = FastAPI(
    title="BLE Smart Monitoring ML Service",
    description="Machine Learning Analytics API augmenting the existing telemetry ingestion pipeline.",
    version="0.1.0",
    lifespan=lifespan
)


# ── Request / Response models ──────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """On-demand anomaly scoring payload."""
    nodeId: str
    temperature: float
    humidity: float
    co2: float
    tvoc: float
    eco2: float
    pm1_0: float
    pm2_5: float
    pm4_0: float
    pm10: float
    lightIntensity: float


class AnalyzeResponse(BaseModel):
    nodeId: str
    anomaly: bool
    message: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health", tags=["Operations"])
async def health_check():
    """Healthcheck endpoint for Docker orchestration."""
    return {"status": "up", "service": "ml-service"}


@app.get("/status", tags=["Operations"])
async def model_status():
    """
    Returns the current baseline collection progress for every tracked node.
    Useful for knowing when the model has auto-fitted and anomaly detection is active.
    """
    status = {}
    for node_id, detector in detector_manager.detectors.items():
        status[node_id] = {
            "fitted": detector.is_fitted,
            "baseline_samples_collected": len(detector.baseline_data),
            "baseline_window_size": detector.baseline_window_size,
        }
    return {"nodes": status, "baseline_window_size": settings.baseline_window_size}


@app.post("/analyze", response_model=AnalyzeResponse, tags=["ML"])
async def analyze(request: AnalyzeRequest):
    """
    On-demand anomaly scoring for a single telemetry reading.

    Submits the 5-dimensional feature vector to the per-node IsolationForest model.
    If the model has not yet been fitted (baseline still accumulating), ``anomaly``
    will always be ``false`` and the reading contributes to the baseline pool.
    """
    features = [
        request.temperature,
        request.humidity,
        request.co2,
        request.tvoc,
        request.eco2,
        request.pm1_0,
        request.pm2_5,
        request.pm4_0,
        request.pm10,
        request.lightIntensity,
    ]
    is_anomaly = detector_manager.process(request.nodeId, features)
    return AnalyzeResponse(
        nodeId=request.nodeId,
        anomaly=is_anomaly,
        message=(
            "Anomaly detected by IsolationForest" if is_anomaly
            else "Reading within normal range"
        ),
    )
