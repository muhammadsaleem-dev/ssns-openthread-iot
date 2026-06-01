# BLE Smart Monitoring Backend Service

## Overview
The `ble-smart-monitoring-backend` is a Java-based microservice built on Spring Boot 3.3. It acts as the central telemetry ingestion, monitoring, alert management, and persistence layer for the **BLE-Based Intelligent Indoor Environmental Monitoring System**.

This service receives environmental data from the BLE Gateway, stores it in MongoDB, evaluates deterministic safety thresholds, and provides REST APIs for the React Dashboard and the Machine Learning anomaly detection service.

Key highlights:
*   **Spring Boot REST Backend:** Provides a robust, scalable API for data ingestion and retrieval.
*   **BLE Telemetry Ingestion:** Accepts structured sensor data from edge gateways.
*   **Node Health Monitoring:** Automatically detects and alerts on sensor node inactivity.
*   **Alert Management:** Manages both threshold-based alerts and externally generated ML alerts.
*   **MongoDB Persistence:** Uses a document database to handle flexible sensor data schemas.

## Features
*   **REST API Telemetry Ingestion:** Endpoint for receiving real-time sensor data.
*   **Environmental Telemetry Persistence:** Stores historical data for charting and analysis.
*   **Node Status Monitoring:** Tracks active nodes and their last-seen timestamps.
*   **Scheduled Health Checks:** Background task to identify offline nodes.
*   **Threshold-Based Alerting:** Immediate evaluation of safety limits (e.g., high temperature).
*   **External ML Alert Integration:** Ingests behavioural anomaly alerts from the separate Python ML service.
*   **Docker Deployment Support:** Fully containerised for easy orchestration.

## Architecture Role
The backend service serves as the central orchestration and persistence hub of the platform:
*   **Ingestion:** Receives data from the **BLE Gateway**.
*   **Analytics Integration:** Provides data to and accepts alerts from the **ML Anomaly Detection Service**.
*   **Storage:** Direct interaction with the **MongoDB** database.
*   **Presentation:** Serves data and alert feeds to the **React Dashboard**.

> [!IMPORTANT]
> **Core Reliability:** The backend's deterministic threshold monitoring operates independently of the ML service. Core safety monitoring remains operational even if the advanced analytics layer is unavailable.

## Technology Stack
*   **Language:** Java 21
*   **Framework:** Spring Boot 3.3
*   **Database:** MongoDB
*   **Build Tool:** Maven
*   **Containerisation:** Docker

## Project Structure
The project follows a standard Spring Boot layered architecture:

*   **Controllers:** Handle HTTP requests (e.g., `SensorDataController`, `AlertController`, `NodeController`).
*   **Services:** Contain business logic.
    *   `SensorDataService.java`: Manages telemetry ingestion and triggers threshold evaluation.
    *   `AlertService.java`: Manages alert creation and retrieval.
*   **Monitoring:**
    *   `NodeHealthMonitor.java`: A scheduled component that checks for inactive nodes and marks them `OFFLINE`.
*   **DTOs:** Data Transfer Objects for API requests and responses.
    *   `SensorDataRequest.java`: Represents the incoming telemetry payload.
*   **Repositories:** Spring Data MongoDB interfaces for database access.

## Telemetry Processing Workflow
1.  **Ingest:** The BLE gateway forwards telemetry via HTTP POST.
2.  **Validate:** The backend validates the payload structure (e.g., `SensorDataRequest`).
3.  **Persist:** Telemetry is stored in MongoDB.
4.  **Update Status:** The corresponding node's `lastSeenAt` timestamp is updated, marking it `ONLINE`.
5.  **Evaluate:** `AlertService` checks readings against hardcoded safety thresholds.
6.  **Alert:** If a threshold is breached, an alert is persisted.
7.  **Dashboard Access:** The React dashboard polls the backend to display the latest charts and alerts.

## Node Health Monitoring
The backend includes a dedicated health monitor (`NodeHealthMonitor.java`) that runs on a schedule:
*   Queries nodes currently marked as `ONLINE`.
*   Compares their `lastSeenAt` timestamp with a configurable timeout (e.g., 120 seconds).
*   If a node is unresponsive, its status is updated to `OFFLINE`.
*   Generates a `NODE_OFFLINE` alert in the unified feed.

## Alerting Architecture
The backend supports a hybrid alerting pipeline:
1.  **Deterministic Alerts:** Evaluated on write by the backend (e.g., Temperature > 35°C).
2.  **External ML Alerts:** Pushed to the backend via POST requests from the ML service when multi-variable anomalies are detected.
Both paths write to the same `alerts` collection, providing a single source of truth for the frontend.

## Safety and Reliability Considerations
*   **Fault Isolation:** Threshold monitoring is synchronous and local to the backend, ensuring it works even if the ML service or Gateway crashes.
*   **Automatic Recovery:** Nodes are automatically marked `ONLINE` again as soon as they send a new telemetry packet.
*   **Containerisation:** Isolates the backend from environment-specific dependency issues.

## API Overview

### Telemetry Ingestion
`POST /api/sensor-data`
```json
{
  "nodeId": "node-01",
  "temperature": 25.4,
  "lightIntensity": 500.0,
  "airQualityLevel": 50.0,
  "co2Equivalent": 400.0,
  "mq135Raw": 100.0
}
```

### Get Active Alerts
`GET /api/alerts`
Response:
```json
[
  {
    "nodeId": "node-01",
    "type": "ML_ANOMALY",
    "severity": "WARNING",
    "message": "IsolationForest detected unusual multi-variable behavior pattern",
    "createdAt": "2026-05-12T14:22:00Z"
  }
]
```

## Setup Instructions

### Local Development

1.  **Ensure MongoDB is running:**
    The backend expects a MongoDB instance on `localhost:27017` by default (or configured via `application.properties`).

2.  **Build the Project:**
    ```bash
    mvn clean package
    ```

3.  **Run the Application:**
    ```bash
    mvn spring-boot:run
    ```

### Docker Execution
```bash
docker build -t ble-backend .
docker run -p 8080:8080 -e MONGODB_URI=mongodb://host.docker.internal:27017/ble_monitoring ble-backend
```

## Future Extensions
The following items are planned for future exploration and are not in the current implementation scope:
*   **Multi-Node Deployment Expansion:** Optimising DB queries for large-scale node deployments.
*   **Streaming Telemetry:** Implementing Server-Sent Events (SSE) or WebSockets for real-time updates without polling.
*   **MQTT Integration:** Adding an MQTT adapter to support non-HTTP gateways.
*   **Advanced Alert Workflows:** Adding email/SMS notification dispatchers.
