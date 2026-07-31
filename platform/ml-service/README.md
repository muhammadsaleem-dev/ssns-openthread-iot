# Thread Smart Monitoring ML Service

## Overview
The `thread-smart-monitoring-ml-service` is a Python-based microservice that provides unsupervised anomaly detection and predictive forecasting for indoor environmental telemetry. It is a core component of the **Thread-Based Intelligent Indoor Environmental Monitoring System**, designed to move beyond conventional single-threshold alerting by identifying complex, multi-variable environmental anomalies.

The service leverages a **Robust-Scaled Isolation Forest** algorithm to learn the normal operating baseline of an environment and detect deviations in real-time, along with an **R-Squared Gated Linear Forecaster** to predict future gas and particulate accumulation. 

## Features
*   **Real-Time Telemetry Polling:** Asynchronously fetches the latest sensor data from the Spring Boot backend every 15 seconds (configurable via `poll_interval_seconds`).
*   **12-Dimensional Core Feature Vector:** Distills raw telemetry into 5 core physical sensors (Temp, Humidity, CO2, TVOC, PM2.5), 5 per-minute rates of change, and 2 diurnal (time-of-day) sine/cosine markers.
*   **4-Tier Data Imputation:** Cleanly handles dropped or missing sensor packets using short-term LOCF (Last Observation Carried Forward), medium-term exponential damped decay, long-term masking, and complete-frame fault rejection.
*   **Multi-Variable Anomaly Detection:** Evaluates joint distributions using an `IsolationForest` (with `contamination="auto"`) and robust Median/IQR scaling to prevent single high-variance sensors from blinding the model.
*   **Automated Drift Retraining:** Continuously monitors the Kolmogorov-Smirnov ($D_{KS}$) divergence. If the environment undergoes a seasonal baseline shift without high variance, the model autonomously rebuilds its tree ensemble.
*   **R-Squared Gated Predictive Forecasting:** Projects CO2 and PM2.5 levels into the future (horizon configurable via Dashboard, defaults to 30 mins), fixing the runaway alert issues of naive linear regression via three mechanisms:
    *   **EMA Smoothing:** Applies an Exponential Moving Average shock-absorber *before* calculating the slope, preventing momentary breath spikes from throwing off the trajectory.
    *   **$R^2$ Variance Gating:** Mathematically checks the goodness-of-fit. If $R^2 < 0.65$, it determines the trend is just random air turbulence and suppresses the forecast to prevent false alarms.
    *   **Physical Saturation Clamping:** Enforces realistic mass-balance ceilings (e.g., capping CO2 at 4000 ppm) so the model cannot predict mathematically impossible concentrations.
*   **eXplainable AI (XAI) & Contextual Interpretability:** Computes robust Z-scores on the fly to explain *exactly why* an alert was triggered, naming the mathematical drivers (e.g., "Top Culprits: CO2_Rate +250%").
*   **Autonomous Recommended Actions:** Beyond just detecting issues, the engine generates actionable mitigation strategies (e.g., "Proactively increase fresh air intake") embedded directly into the alert to assist human operators.
*   **Asynchronous Background Processing:** Polling and inference run without blocking API requests.
*   **HTTP Alert Dispatch:** Automatically posts detected anomalies and forecast warnings back to the backend alert system, and autonomously resolves them when conditions normalize.

## Dashboard Control & Node-Specific Models
The ML service operates entirely as a slave to the central Dashboard, retaining the following architectural relationships:
*   **Dedicated Model Pairs Per Node:** The ML Engine dynamically manages a strict 1-to-1 mapping for *both* of its analytical engines (`NodeAnomalyDetectorManager` and `NodeForecasterManager`). This means a sensor node in a crowded conference room has its own isolated `IsolationForest` baseline and its own dedicated `LightweightForecaster` rolling window, entirely separate from a node in a quiet storage closet.
*   **Dynamic Sensitivity:** Dashboard users can adjust the ML sensitivity slider. The poller passes this value into the engine to dynamically shift the `IsolationForest` decision boundary on the fly—no container restart required.
*   **Calibration Control:** The `baselineWindowSize` defined by the dashboard strictly dictates the warm-up calibration phase for each node.
*   **Alert Rate-Limiting:** To prevent alert fatigue, the ML engine enforces a strict cooldown period (`ALERT_COOLDOWN_SECONDS`, default 60s). It will never spam the dashboard with more than 1 alert per minute per node, regardless of how often the poller runs.
*   **Autonomous Self-Healing:** While users can trigger manual recalibration, the newly implemented Kolmogorov-Smirnov ($D_{KS}$) drift detector makes this largely obsolete. If a room undergoes a permanent seasonal shift (e.g., Summer AC to Winter Heating), the model autonomously flushes its memory and recalibrates without dashboard user intervention.

## Architecture Role
This service acts as a supplementary analytics layer within the broader monitoring platform:
1.  **Ingestion:** The Thread Gateway forwards sensor data to the Spring Boot Backend.
2.  **Polling:** This ML service periodically polls the backend for the latest readings.
3.  **Inference:** It runs the data through the Anomaly Engine and Lightweight Forecaster.
4.  **Alerting:** If an anomaly is detected or a breach is forecast, it pushes an alert back to the Backend, which is then displayed on the React Dashboard.

> [!IMPORTANT]
> **Safety and Reliability Disclaimer:** This ML subsystem provides supplementary analytical intelligence. It is **not** a safety-critical component. Deterministic threshold alerts evaluated directly by the backend remain fully operational and independent of this service's availability.

## Technology Stack
*   **Language:** Python 3.12
*   **Framework:** FastAPI
*   **ML Library:** scikit-learn (Isolation Forest), NumPy
*   **HTTP Client:** httpx (async requests)
*   **Persistence:** joblib (model serialisation)
*   **Containerisation:** Docker

## Project Structure
*   **`app/main.py`**: The entry point for the FastAPI application. Handles app lifecycle, configuration loading, and exposes health/status endpoints.
*   **`app/ml/ml_engine.py`**: Contains the anomaly detection logic using robust Median/IQR scaling and `IsolationForest`. Manages data imputation, model fitting, drift retraining, and Z-score attribution.
*   **`app/ml/forecaster.py`**: Contains the predictive forecasting logic using exact $R^2$-gated Linear Regression and saturation clamping.
*   **`app/services/poller.py`**: Implements the background task that manages feature extraction (calculating rates of change and diurnal encoding), fetches telemetry, triggers inference, and dispatches/resolves alerts.
*   **`requirements.txt`**: Lists the Python dependencies required to run the service.

## Setup Instructions

### Local Development

1.  **Create a Virtual Environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

3.  **Run the Service:**
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ```

### Docker Execution
To run as part of the complete system, use the root directory's docker-compose file, or run standalone:
```bash
docker build -t thread-ml-service .
docker run -p 8000:8000 -e BACKEND_URL=http://host.docker.internal:8080 thread-ml-service
```

## Evaluation & Validation
The live pipeline implements the mathematical anomaly and forecasting models for real-time edge processing. Formal offline statistical validation has been successfully conducted using the `scripts/evaluate.py` script against the `data/saleems_room_node_e9b1.csv` historical dataset. 

The evaluation rigorously validated the TPR (True Positive Rate), FPR (False Positive Rate), TTD (Time to Detection), MAE, and RMSE for both the Isolation Forest and Lightweight Forecaster under normal conditions, simulated data drift, and packet drop scenarios.

## Documentation
For deep-dive technical details on how the system is architected, please see the central documentation folder located at `../../docs/ml-service enhancement/`:
*   [Current Implementation Details](../../docs/ml-service%20enhancement/ML_CURRENT_IMPLEMENTATION_DETAILS.md)
*   [Node Mapping Architecture](../../docs/ml-service%20enhancement/ML_NODE_MAPPING_ARCHITECTURE.md)

## Example API / Alert Payload

### Incoming Telemetry (Processed by ML)
The poller fetches standard telemetry, but extracts only the core 5 physical variables to prevent collinearity dominance:
```json
{
  "nodeId": "node-01",
  "temperature": 23.5,
  "humidity": 45.2,
  "co2": 450.0,
  "tvoc": 120.0,
  "pm2_5": 12.4,
  "timestamp": "2026-07-31T12:00:00+00:00"
}
```

### Generated ML Anomaly Alert
```json
{
  "nodeId": "node-01",
  "type": "ML_ANOMALY",
  "severity": "WARNING",
  "message": "IsolationForest detected unusual multi-variable behavior pattern on node-01",
  "context": "Anomaly score: -0.12 | Key drivers: CO2_Rate (+250% vs baseline), TVOC (+85% vs baseline)",
  "recommendedAction": "Rapid change detected. Temporary activity or movement. No action needed unless it persists."
}
```

### Generated Predictive Forecast Alert
```json
{
  "nodeId": "node-01",
  "type": "FORECAST_WARNING",
  "severity": "WARNING",
  "message": "CO2 projected to reach 1521ppm within 30 minutes.",
  "context": "Projection in 30m | CO2: 1521 ppm (+25.3/min) | PM2.5: 28.4 µg/m³ (+0.79/min) | Based on 60 readings",
  "recommendedAction": "Proactively increase fresh air intake to prevent CO2 breach."
}
```