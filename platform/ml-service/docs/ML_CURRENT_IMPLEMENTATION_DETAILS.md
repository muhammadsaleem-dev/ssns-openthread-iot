# ML Service: Current Implementation Details

## Executive Summary
The `thread-smart-monitoring-ml-service` is an asynchronous, non-blocking Python microservice that provides intelligent, unsupervised anomaly detection and predictive forecasting for Thread-based IoT indoor environmental monitoring. Unlike conventional threshold-based alerting systems, this service mathematically learns the unique "normal" baseline of every individual room, applies robust imputation and scaling to handle real-world noisy sensor data, and autonomously detects multi-variable anomalies while predicting future gas accumulation. The system is designed for complete autonomy, managing its own 1-to-1 node model mapping, persistence, and environmental drift auto-healing without human intervention.

## Table of Contents
1. [System Architecture & Flow](#1-system-architecture--flow)
2. [Node-Specific Model Mapping (1-to-1 Architecture)](#2-node-specific-model-mapping-1-to-1-architecture)
3. [Dashboard Control & Configuration](#3-dashboard-control--configuration)
4. [Feature Engineering & Pre-Processing](#4-feature-engineering--pre-processing)
   - [4.1 The 12-Dimensional Feature Vector](#41-the-12-dimensional-feature-vector)
   - [4.2 4-Tier Data Imputation](#42-4-tier-data-imputation)
5. [Anomaly Detection (IsolationForest)](#5-anomaly-detection-isolationforest)
6. [Predictive Forecasting (LightweightForecaster)](#6-predictive-forecasting-lightweightforecaster)
7. [eXplainable AI (XAI) & Interpretability](#7-explainable-ai-xai--interpretability)
8. [Lifecycle Management](#8-lifecycle-management)

---

This document outlines the exact technical implementation of the `thread-smart-monitoring-ml-service` as it currently runs in the environment. It covers the data ingestion pipeline, feature engineering, mathematical models, and lifecycle management.

## 1. System Architecture & Flow
The ML service operates as an asynchronous, non-blocking sidecar to the Spring Boot backend. 

1. **Polling (`app/services/poller.py`)**: A background asynchronous task (`asyncio.sleep`) polls the Spring Boot backend (`/api/telemetry/latest`) every 15 seconds.
2. **Feature Extraction**: Raw sensor packets are parsed and expanded into a 12-dimensional feature vector.
3. **Inference (`app/ml/ml_engine.py` & `forecaster.py`)**: The vector is passed to the dynamically loaded mathematical models specific to that sensor node.
4. **Alert Dispatch**: If thresholds or anomaly scores are breached, a POST request is sent back to the backend's alert endpoints (`/api/alerts/anomaly` and `/api/alerts/forecast`), which are immediately broadcast via WebSockets to the React Dashboard.

## 2. Node-Specific Model Mapping (1-to-1 Architecture)
A core challenge in indoor environmental monitoring is that no two rooms are the same. A standard CO2 level in a packed lecture hall (e.g., 1200 ppm) is perfectly normal, but that same level in an empty storage closet indicates a severe ventilation failure. Because of this, global thresholds and shared ML models do not work.

To solve this, the ML Service implements a strict **One-to-One Dynamic Mapping Strategy**. Every single hardware node on the Thread mesh network gets its own completely isolated `IsolationForest` baseline and its own `LightweightForecaster` memory window. 

* **Lazy Loading**: When the Poller fetches telemetry, it passes the `nodeId` to the central managers. If the manager has never seen this `nodeId` before, it dynamically creates a new `AnomalyDetector` class instance in memory specifically for that node.
* **Isolated Baselines**: A node in a crowded room calibrates on its own history, entirely separate from a node in an empty closet.

## 3. Dashboard Control & Configuration
The ML service is designed to be completely headless and operates entirely as a "slave" to the central React Dashboard. The reason for this architectural choice is to give the end-user (facility managers or administrators) absolute control over the AI without needing to write code or modify server configurations.

* **Dynamic Sensitivity Adjustment**: The dashboard provides an ML sensitivity slider. This value is passed continuously to the ML engine on the fly. The engine mathematically shifts the `IsolationForest` decision boundary threshold based on this slider, allowing users to tune out false positives instantly without restarting the ML container.
* **Calibration Control**: The `baselineWindowSize` (which dictates how many days of data a node needs to learn its baseline) is controlled by the dashboard configuration.
* **Alert Cooldown Limiting**: To prevent "alert fatigue" on the dashboard, the ML engine enforces a strict cooldown period. It will never spam the backend with more than 1 alert per minute per node, regardless of how aggressively the environment fluctuates.

## 4. Feature Engineering & Pre-Processing
Before any ML algorithm touches the data, raw telemetry is significantly transformed to handle real-world physical constraints and network packet loss.

### 4.1. The 12-Dimensional Feature Vector
To prevent standard environmental states from dominating the algorithms, the system derives velocity and time context from the raw sensors:
*   **5 Base Sensors**: `Temperature`, `Humidity`, `CO2`, `TVOC`, `PM2.5`
*   **5 Velocity Rates (Delta/Min)**: By comparing the current packet to the previous packet and dividing by the exact time delta `dt`, the system captures the *Rate of Change* (e.g., how fast CO2 is rising).
*   **2 Diurnal Embeddings**: The time of day is converted into a cyclical trigonometric vector (`sin(time)`, `cos(time)`). This ensures 11:59 PM and 12:01 AM are mathematically adjacent, allowing the algorithm to learn repeating daily patterns (e.g., office hours vs. empty nights).

### 4.2. 4-Tier Data Imputation
Wireless IoT networks suffer from packet drops. If a vector contains `NaN` or `-999.0`, the ML engine applies strict imputation rules to prevent false anomaly triggers:
1.  **Short Drop (< 5 min)**: **LOCF** (Last Observation Carried Forward).
2.  **Medium Drop (5 - 60 min)**: **Damped Decay**. The value exponentially decays toward the historical room median with a 30-minute half-life ($\lambda \approx 0.000385$).
3.  **Long Drop (> 60 min)**: **Masking**. The channel is hard-clamped to the median to effectively mute it from the anomaly detector.

## 5. Anomaly Detection (`IsolationForest`)
The system uses an unsupervised `sklearn.ensemble.IsolationForest` to identify multi-variable deviations.

*   **Calibration Window**: The algorithm waits for `baselineWindowSize` (configurable via dashboard, typically 14 days) to build a robust environmental profile before activating.
*   **Robust Scaling**: Standard Z-scaling is susceptible to outliers. Instead, the engine computes the **Median** and **Interquartile Range (IQR)** of the 14-day calibration data to scale incoming vectors before they hit the trees:
    $$ X_{scaled} = \frac{X - \text{Median}}{\text{IQR}} $$

## 6. Predictive Forecasting (`LightweightForecaster`)
To provide early warnings, the service forecasts CO2 and PM2.5 accumulation trajectories using an $R^2$-Gated Linear Regression.

*   **EMA Shock-Absorber**: Raw telemetry is heavily jittered. An Exponential Moving Average ($\alpha = 0.15$) is applied to smooth the signal before calculating the slope, preventing random breath spikes from triggering massive false forecasts.
*   **$R^2$ Variance Gating**: The model mathematically computes the Pearson Correlation Coefficient squared ($R^2$) of the rolling window. If $R^2 < 0.65$ (the slope is chaotic, random noise), it aborts the forecast entirely to prevent false alarms.
*   **Saturation Clamping**: Physical gases cannot increase infinitely. The engine enforces hard biological bounds (e.g., CO2 is clamped at a theoretical maximum of 4000 ppm) so the forecast remains physically realistic.

## 7. eXplainable AI (XAI) & Interpretability
When the mathematical engine detects an anomaly, it does not just send a generic alert. It uses **eXplainable AI (XAI)** techniques to tell the human operator *exactly why* the alert fired.
* **Robust Z-Score Attribution**: When the decision score drops below the sensitivity threshold, the system calculates the robust Z-score for all 10 physical features. It mathematically extracts the top two most severe deviating features.
* **Contextual Explanations**: The engine injects this plain-english context directly into the alert payload (e.g., "CO2_Rate +250% vs baseline").
* **Recommended Actions**: Based on the top driver, the AI autonomously attaches a mitigation strategy (e.g., if TVOC spikes: "Chemical odors or aerosols detected. Check for cleaning sprays or spills.").

## 8. Lifecycle Management
To run continuously in a production environment without manual intervention, the models manage their own lifecycles.

*   **Joblib Serialization**: Fitted models and their exact mathematical scalers (IQR/Medians) are persisted to disk (`/tmp/thread_ml_models/`). If the container restarts, the memory is instantly restored without requiring a recalibration phase.
*   **Kolmogorov-Smirnov ($D_{KS}$) Drift Auto-Healing**: The engine constantly runs a KS-test comparing the original 14-day calibration baseline against the most recent rolling window. If the environment structurally shifts (e.g., seasonal HVAC changes) and the variance remains stable, the detector flushes its serialized model and autonomously recalibrates to the new environmental norm.
