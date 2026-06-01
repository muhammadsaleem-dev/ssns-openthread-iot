# BLE Smart Monitoring ML Service

## Overview
The `ble-smart-monitoring-ml-service` is a Python-based microservice that provides unsupervised anomaly detection for indoor environmental telemetry. It is a core component of the **BLE-Based Intelligent Indoor Environmental Monitoring System**, designed to move beyond conventional single-threshold alerting by identifying complex, multi-variable environmental anomalies.

The service leverages the **Isolation Forest** algorithm to learn the normal operating baseline of an environment and detect deviations in real-time. It runs as a FastAPI application, interacting asynchronously with the system's backend to process telemetry and dispatch alerts.

Key highlights:
*   **Isolation Forest Anomaly Detection:** Unsupervised learning suitable for detecting rare and novel environmental events.
*   **Real-Time Telemetry Analysis:** Continuous evaluation of incoming sensor data.
*   **Decoupled Architecture:** Operates independently of the core telemetry ingestion pipeline to ensure system resilience.
*   **Scalable Design:** Built to support independent models for multiple sensor nodes.

## Features
*   **Real-Time Telemetry Polling:** Asynchronously fetches the latest sensor data from the Spring Boot backend.
*   **Multi-Variable Anomaly Detection:** Evaluates joint distributions using Isolation Forest rather than treating parameters in isolation.
*   **Predictive Forecasting:** Uses rolling-window linear regression to project CO2 and PM2.5 levels 30 minutes into the future.
*   **Contextual Interpretability:** Computes Z-scores and trend slopes on the fly to explain *why* an alert was triggered.
*   **Asynchronous Background Processing:** Polling and inference run without blocking API requests.
*   **HTTP Alert Dispatch:** Automatically posts detected anomalies back to the backend alert system.
*   **Model Persistence:** Uses `joblib` to save and restore trained models, avoiding re-calibration after restarts.
*   **FastAPI REST Microservice:** Provides a lightweight, high-performance API for status checks and manual inference.
*   **Docker-Compatible:** Fully containerised for deployment in a distributed environment.

## Architecture Role
This service acts as a supplementary analytics layer within the broader monitoring platform:
1.  **Ingestion:** The BLE Gateway forwards sensor data to the Spring Boot Backend.
2.  **Polling:** This ML service periodically polls the backend for the latest readings.
3.  **Inference:** It runs the data through the Isolation Forest model.
4.  **Alerting:** If an anomaly is detected, it pushes an alert back to the Backend, which is then displayed on the React Dashboard.

> [!IMPORTANT]
> **Safety and Reliability Disclaimer:** This ML subsystem provides supplementary analytical intelligence. It is **not** a safety-critical component. Deterministic threshold alerts evaluated directly by the backend remain fully operational and independent of this service's availability.

## Technology Stack
*   **Language:** Python 3.12
*   **Framework:** FastAPI
*   **ML Library:** scikit-learn (Isolation Forest)
*   **HTTP Client:** httpx (async requests)
*   **Persistence:** joblib (model serialisation)
*   **Containerisation:** Docker

## Project Structure
*   **`app/main.py`**: The entry point for the FastAPI application. Handles app lifecycle, configuration loading, and exposes health/status endpoints.
*   **`app/ml/ml_engine.py`**: Contains the anomaly detection logic using `IsolationForest`. Manages model fitting, Z-score attribution, and persistence.
*   **`app/ml/forecaster.py`**: Contains the predictive forecasting logic using `LinearRegression` over a rolling time window.
*   **`app/services/poller.py`**: Implements the background task that periodically fetches telemetry from the backend, triggers inference, and dispatches alerts.
*   **`requirements.txt`**: Lists the Python dependencies required to run the service.

## Telemetry Processing Workflow
1.  **Expose:** The Spring Boot backend exposes a REST endpoint for the latest telemetry.
2.  **Fetch:** The async poller in this service requests the latest data every $N$ seconds.
3.  **Process:** The `ml_engine` processes the feature vector through the corresponding node's model.
4.  **Detect:** If the model score indicates an anomaly, the service generates an alert payload.
5.  **Dispatch:** The alert is sent via HTTP POST to the backend's `/api/alerts` endpoint.

## Model Behaviour
*   **Unsupervised Learning:** Since environmental anomalies are rare and hard to catalogue, the anomaly model requires no labelled training data.
*   **Baseline Calibration:** The anomaly model requires a "warm-up" period (e.g., the first 20 observations) to establish what "normal" looks like for a specific node.
*   **Rolling Window Forecasting:** The forecaster maintains a rolling memory buffer of the last 60 readings (approx. 5 minutes) to calculate real-time gas accumulation slopes.
*   **Node Specificity:** Models are managed per-node to account for the fact that different rooms have different baseline environments.
*   **Persistence:** Once the anomaly baseline is established, the model is saved to disk so service restarts do not trigger a new warm-up phase.

## Alerting Philosophy: Management by Exception
This service strictly adheres to a **Management by Exception** design philosophy. While the linear regression algorithm mathematically projects both dangerous (rising) and safe (falling/improving) trends equally well, the alerting pipeline intentionally suppresses "positive" predictions (e.g., "CO2 returning to normal"). Alerts are exclusively emitted when negative threshold breaches are imminent. This prevents alert fatigue and ensures the dashboard only interrupts human operators when intervention is strictly required.

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
docker build -t ble-ml-service .
docker run -p 8000:8000 -e BACKEND_URL=http://host.docker.internal:8080 ble-ml-service
```

## Example API / Alert Payload

### Incoming Telemetry (Processed by ML)
```json
{
  "nodeId": "node-01",
  "temperature": 23.5,
  "humidity": 45.2,
  "co2": 450.0,
  "tvoc": 120.0,
  "eco2": 460.0,
  "pm1_0": 5.2,
  "pm2_5": 12.4,
  "pm4_0": 15.1,
  "pm10": 18.3,
  "lightIntensity": 300.0,
  "timestamp": "ISO-8601 string"
}
```

### Generated ML Anomaly Alert
```json
{
  "nodeId": "node-01",
  "type": "ML_ANOMALY",
  "severity": "WARNING",
  "message": "IsolationForest detected unusual multi-variable behavior pattern on node-01",
  "context": "Anomaly score: -0.05 | Key drivers: PM10 (+316% vs baseline), PM2.5 (+317% vs baseline)"
}
```

### Generated Predictive Forecast Alert
```json
{
  "nodeId": "node-01",
  "type": "FORECAST_WARNING",
  "severity": "WARNING",
  "message": "CO2 projected to reach 1521ppm within 30 minutes.",
  "context": "Projection in 30m | CO2: 1521 ppm (+25.3/min) | PM2.5: 28.4 µg/m³ (+0.79/min) | Based on 14 readings"
}
```

## Future Extensions
The following enhancements are identified as potential improvements outside the current implementation scope:
*   **Multi-Node Scalability:** Enhancing the manager to handle dynamic scaling for hundreds of nodes.
*   **Streaming Telemetry:** Moving from polling to a push-based streaming model (e.g., SSE or WebSockets).
*   **Alternative Models:** Exploring LSTM autoencoders for better temporal analysis as more historical data is collected.
*   **MQTT Integration:** Direct subscription to telemetry brokers.
*   **Enhanced Dashboarding:** Visualising the model's decision boundaries and scores.