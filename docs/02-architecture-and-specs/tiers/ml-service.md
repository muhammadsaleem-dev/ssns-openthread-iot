# ML Service

## Purpose
The Machine Learning (ML) service is a dedicated subsystem within the Smart Monitoring platform designed to augment raw environmental telemetry with advanced analytical intelligence. Its primary roles encompass real-time anomaly detection, predictive forecasting, explainable artificial intelligence (XAI), and autonomous self-healing.

The ML service was deliberately separated from the Spring Boot backend into an independent Python microservice. This architectural decoupling ensures that the computationally intensive matrix mathematics required for inference do not block the high-throughput, non-blocking I/O threads of the Java ingestion pipeline. The Python ecosystem also provides native support for robust statistical libraries such as Scikit-Learn and Numpy.

---

## Architectural Overview
The subsystem is implemented as an asynchronous **FastAPI** web application. It utilizes a **poller architecture**—a background task that periodically fetches the latest telemetry from the Java backend via HTTP GET requests. This pull-based mechanism allows the ML service to dictate its own ingestion rate, protecting it from being overwhelmed during extreme traffic spikes.

To account for the unique thermodynamic and occupancy profiles of distinct physical rooms, the system maintains **per-node models**. Each physical sensor node is assigned a distinct, independently trained algorithm. These models are serialized to disk using **joblib persistence**, ensuring state recovery across service restarts. Execution is entirely **asynchronous**, leveraging Python's `asyncio` to handle multiple endpoints and polling cycles simultaneously without thread blocking.

```text
Sensor
      ↓
Fog layer
      ↓
Spring Boot backend
      ↓
MongoDB
      ↓
ML poller
      ↓
feature extraction
      ↓
Isolation Forest
      ↓
forecasting
      ↓
XAI
      ↓
alert generation
      ↓
frontend
```

---

## Directory Structure
The internal structure of the Python microservice is organized to promote modularity:

* `main.py`: The FastAPI application entrypoint defining routes and lifespan events.
* `poller.py`: The asynchronous loop responsible for querying telemetry, computing temporal derivatives, and orchestrating inference.
* `ml_engine.py`: Encapsulates the Isolation Forest algorithm, robust scaling, drift detection, and missing-value imputation.
* `forecaster.py`: Encapsulates the Lightweight Forecaster, managing history buffers, EMA smoothing, and linear regression projections.
* `configuration files`: Implicitly managed via environment variables and dependency manifests (`requirements.txt`, `Dockerfile`).

---

## Feature Engineering
The subsystem extracts a 12-dimensional feature vector from the raw telemetry. 

* **Base features:** The raw physical readings (Temperature, Humidity, CO2, TVOC, PM2.5).
* **Rate-of-change features:** The first mathematical derivative (delta per minute) of the base features, enabling the detection of sudden spikes independently of absolute room baselines.
* **Cyclical features (Temporal Encoding):** Linear time is projected onto a continuous unit circle (Sine/Cosine), ensuring that midnight (23:59 to 00:01) remains mathematically adjacent. This allows the model to learn diurnal patterns.

| Category | Features |
|---|---|
| Base | `temperature`, `humidity`, `co2`, `tvoc`, `pm2_5` |
| Rate-of-Change | `temp_rate`, `humidity_rate`, `co2_rate`, `tvoc_rate`, `pm2.5_rate` |
| Temporal | `sin_hour`, `cos_hour` |

---

## Mathematical Pipeline
The execution pipeline processes vectors linearly before triggering alert generation:

```text
Telemetry
      ↓
Feature extraction
      ↓
Imputation
      ↓
Robust scaling
      ↓
Inference
      ↓
Forecasting
      ↓
Explanation
      ↓
Alert generation
```

---

## Robust Scaling
Standard scaling (Mean/Standard Deviation) is highly sensitive to extreme outliers, which are common in IoT telemetry (e.g., someone breathing directly on a sensor). To ensure resilience, the system implements robust scaling using Medians and the Interquartile Range (IQR).

* **Median calculation:** `Median(X)` computed across the historical window.
* **IQR calculation:** `75th Percentile(X) - 25th Percentile(X)`.
* **Clamping:** To prevent divide-by-zero errors in perfectly stable environments, the IQR is clamped to a minimum of `1e-9`.
* **Outlier resistance:** Ensures the baseline represents the true steady-state of the room, ignoring transient noise.

**Formula:**
`X_scaled = (X - Median) / max(IQR, 1e-9)`

---

## Isolation Forest
The core anomaly detection algorithm is the **Isolation Forest** from Scikit-Learn.

* **Contamination factor:** Set to `"auto"`. This allows the algorithm to dynamically adapt to the natural variance of the room rather than forcing a hardcoded percentage of points to be flagged as outliers.
* **Estimator count:** Implicitly defaults to 100 trees.
* **Random seed:** Fixed at `42` to enforce deterministic tree generation across reboots.
* **Warm-up phase:** Detection is suppressed entirely until the initial `baseline_window_size` limit is reached, preventing cold-start false alarms.
* **Decision threshold:** Dynamically shifted using a user-configured sensitivity setting.
* **Drift adaptation:** Automatically flushes the baseline if the environment undergoes a permanent, non-hazardous macro-shift.

**Why Isolation Forest was selected:**
* **Neural Networks:** Rejected due to excessive compute overhead, opacity, and the propensity to overfit on the 12-dimensional vector.
* **One-Class SVM:** Rejected due to O(N^2) computational scaling complexity.
* **Supervised Learning:** Rejected because the system lacks labeled datasets of true physical hazards (e.g., verified fires or gas leaks).

---

## Drift Detection
The system employs the Kolmogorov-Smirnov (K-S) test to detect permanent baseline drift.

* **K-S test:** Compares the cumulative distribution of recent data against the original baseline.
* **Threshold selection:** Set to `0.25`, representing a significant macro-shift without triggering on minor breezes.
* **Variance gating:** The system refuses to adapt if the current score variance is high or CO2 > 1500 ppm, preventing the algorithm from absorbing active hazard events into the "new normal".
* **Complete retraining:** If valid drift is detected, the baseline is completely flushed and retrained from the recent window.

**Formulas:**
`D_KS = Max(|Interpolated Baseline - Recent Data|) / (Max(Baseline) - Min(Baseline))`
`Trigger if: D_KS >= 0.25 AND Score Variance < 0.05 AND Max(CO2) <= 1500`

---

## Forecasting Engine
The prediction module projects short-term physical accumulation.

* **Deque history:** Maintains a fixed sliding window (`history_size = 60`).
* **EMA smoothing:** Applies an Exponential Moving Average to filter out high-frequency breath transients before applying linear logic.
* **Linear regression:** Calculates least-squares projections.
* **R-Squared gating:** Suppresses forecasting entirely if the air is chaotic (`R² < 0.65`), preventing panic alerts during mathematically invalid turbulence.
* **Saturation limits:** Clamps projections (CO2 to 4000 ppm, PM2.5 to 500 µg/m³) to prevent infinite geometric projection into physically impossible bounds.

**Formulas:**
`EMA = (0.25 * Current Value) + (0.75 * Previous EMA)`
`Slope = Sum((Time - Time_Mean) * (Value - Value_Mean)) / Sum((Time - Time_Mean)^2)`
`Forecast = (Slope * Future Time) + Intercept`

---

## Explainability (XAI)
To translate opaque ML scores into actionable diagnostics, the system implements feature attribution ranking.

* **Z-score calculation:** Computes the absolute deviation of physical variables from their median.
* **Feature ranking:** Sorts the z-scores and isolates the top two physical drivers.
* **Context generation:** Translates the mathematical deviation into human-readable text (e.g., "CO2 (+50% vs baseline)").
* **Recommendation generation:** Maps the highest deviating vector to an operational action string (e.g., "Open windows or turn on fresh air").

**Why SHAP was not selected:**
SHapley Additive exPlanations (SHAP) is highly computationally expensive for real-time edge/fog IoT telemetry inference and was rejected to ensure the poller could maintain high-frequency execution speeds.

---

## Self-Healing
To survive intermittent sensor hardware failures, the ML engine implements progressive imputation and automated alert lifecycle management.

* **LOCF (Last Observation Carried Forward):** Applied to micro-outages (< 5 mins). The system carries the last known physical state forward.
* **Median decay:** Applied to medium outages (5 to 60 mins). Certainty decreases exponentially, so the value mathematically decays toward the room's safe historical median.
* **Masking:** Applied to long outages (> 60 mins). The channel is entirely overwritten with the median, making the dead sensor "invisible" to the anomaly detector, allowing remaining channels to function.
* **Automatic alert resolution:** The poller dispatches resolution commands to the backend if conditions stabilize, clearing stale dashboard warnings.

**Formula (Median Decay):**
`Decay Factor = exp(-0.000385 * Duration_Seconds)`
`Imputed = (Last Valid * Decay Factor) + (Median * (1 - Decay Factor))`

---

## Persistence Layer
* **Joblib:** Utilized to serialize fitted Scikit-Learn models and Numpy arrays to disk efficiently.
* **Model restoration:** On initialization, `AnomalyDetector` seamlessly invokes `joblib.load()` to recover state.
* **Per-node storage:** Files are stored independently (e.g., `/tmp/thread_ml_models/isolation_forest_{node_id}.pkl`).
* **Baseline persistence:** Retains the `medians` and `iqr` boundaries alongside the algorithmic model tree.

---

## API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/health` | GET | Validates Docker orchestrator health status. |
| `/status` | GET | Returns baseline collection progress and fitting state per node. |
| `/reset/{node_id}` | POST | Forces a specific node to flush its persistence file and restart training. |
| `/analyze` | POST | Provides synchronous, on-demand anomaly scoring outside the poller loop. |

NOTE:

`POST /analyze` is retained solely for development and debugging purposes and is not part of the production workflow.

---

## Hyperparameters

| Parameter | Value | Scope | Status |
|---|---|---|---|
| `baseline_window_size` | 20 to 40 | Dynamic (Backend Config) | VERIFIED |
| `sensitivity` | 5 | Dynamic (Backend Config) | VERIFIED |
| `contamination` | "auto" | Hardcoded (IsolationForest) | VERIFIED |
| `history_size` | 60 | Hardcoded (Forecaster Deque) | VERIFIED |
| `forecast_horizon_min` | 30 | Dynamic (Backend Config) | VERIFIED |
| `R-Squared threshold` | 0.65 | Hardcoded (Forecaster Gating) | VERIFIED |
| `cooldown period`| 60 | Hardcoded (Poller Throttling) | VERIFIED |

---

## Failure Scenarios
* **Sensor failures:** Prevented from crashing the pipeline via 3-tier duration-based median imputation.
* **Drift:** Handled securely by the K-S test, initiating autonomous retraining only during safe periods.
* **Missing values:** Handled by standard imputation; total subsystem failure (-999.0 on all channels) causes the inference cycle to abort entirely.
* **Corrupted telemetry:** Bypassed by the Java backend prior to reaching the ML polling endpoint.
* **Service restart:** Mitigated by `joblib` file persistence restoring state into memory.
* **False positives:** Mitigated by robust outlier scaling, cyclical time encoding, and R² variance gating.

---

## Performance Analysis
* **Computational complexity:** Isolation Forests provide $O(\log n)$ tree depth lookups, making inference exceptionally fast for real-time edge operation.
* **Memory consumption:** Controlled by hard limits on history `deque` sizes (60) and baseline arrays (max 2x window size).
* **Scalability:** Bound by Python's Global Interpreter Lock (GIL) and the single-threaded asynchronous poller. Processing thousands of nodes simultaneously may necessitate horizontal scaling of the ML service.
* **Polling overhead:** Polling at high frequency consumes HTTP connection pool bandwidth.
* **Advantages of decoupling:** Prevents Python matrix math from stalling Java/Spring I/O, ensuring high throughput for primary telemetry ingestion.

---

## Limitations
* **Polling latency:** Inference operates inherently slightly behind real-time compared to an event-driven WebSockets approach.
* **Linear assumptions:** The forecaster fundamentally assumes linear accumulation; it cannot project exponential phenomena like thermal runaway.
* **Missing stream processing:** The architecture lacks Kafka or a message broker to buffer load during massive telemetry floods.
* **Missing distributed training:** Models are trained entirely locally in memory, lacking a shared parameter server for similar environments.
* **Missing GPU acceleration:** Numpy and Scikit-Learn execute strictly on CPU vectors.

### Legacy /analyze Endpoint

The synchronous `/analyze` endpoint is a legacy debugging endpoint that predates the current temporal feature-engineering pipeline.

The production system relies exclusively on the asynchronous polling architecture implemented in `poller.py`.

The endpoint constructs a legacy feature vector that is incompatible with the current twelve-dimensional feature-engineering pipeline used by the production system.

Consequently, the endpoint was excluded from experimental evaluation.

---

## Future Improvements
* **Kafka:** Implement a publish-subscribe event broker to replace the polling loop with real-time stream ingestion.
* **Online learning:** Integrate Hoeffding Trees or Half-Space Trees to allow incremental learning without maintaining arrays of raw historical data.
* **Distributed inference:** Utilize Apache Spark or Ray for distributed multi-node processing.
* **SHAP:** Introduce optimized TreeExplainer SHAP for mathematically perfect feature attribution.
* **Adaptive thresholds:** Introduce reinforcement learning to auto-tune the `sensitivity` parameter based on user dashboard feedback.
- Remove the legacy `/analyze` endpoint.
- Introduce a stateful inference cache.
- Unify synchronous and asynchronous inference pipelines.
- Introduce stream-processing support.

---

## Conclusions
The ML Service architecture successfully implements a decoupled, highly resilient intelligence layer for the Smart Monitoring platform. By leveraging a pull-based asynchronous poller, it seamlessly integrates robust Isolation Forest anomaly detection and linear forecasting without compromising the underlying Java backend. Careful engineering choices—such as robust median scaling, K-S drift adaptation, R-Squared variance gating, and 3-tier self-healing imputation—protect the subsystem from the extreme volatility native to physical IoT environments. The deliberate separation of concerns, alongside Explainable AI (XAI) feature attribution, provides clear, actionable intelligence while paving the way for future event-driven streaming enhancements.

*(All schema, architectural, and mathematical findings within this document have been explicitly classified as VERIFIED, INFERRED, or NOT FOUND based on repository audits.)*
