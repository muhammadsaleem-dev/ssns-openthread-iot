# Smart Sensor Network System (SSNS) – Comprehensive System Specification

This document provides an exhaustive technical specification of the underlying mechanics, network protocols, mathematical models, and deployment architectures of the Smart Sensor Network System (SSNS). It explicitly complements the IEEE Project Report by documenting the exact operational parameters deployed in the final architecture.

---

## 1. Mesh Network Architecture and Topology

The SSNS utilizes a highly decoupled, multi-tier distributed architecture spanning edge, fog, and cloud layers to ensure fault tolerance. 

*   **Edge Layer:** Composed of Nordic Semiconductor nRF52840 nodes operating on the Zephyr RTOS. These nodes act as Full Thread Devices (FTD) or Minimal Thread Devices (MTD) depending on their power source. They acquire environmental data via I2C and transmit it via wireless mesh.
*   **Mesh Topology:** The wireless network is implemented as an IPv6-based OpenThread mesh operating on the IEEE 802.15.4 standard (Channel 26, PanId 0x1235). The mesh guarantees self-healing routing, allowing nodes to dynamically search for new parent routers if an intermediate node fails.
*   **Fog Layer (OTBR):** An OpenThread Border Router (OTBR) acts as the bridge between the 802.15.4 radio network and the standard IPv4/IPv6 local area network. The OTBR translates wireless packets and forwards them to a local Gateway.
*   **Fog Gateway:** A Python-based edge gateway that terminates the CoAP traffic, deduplicates payloads via Redis, anchors them to UTC timestamps, and proxies the telemetry to the central platform tier over HTTP/JSON.

---

## 2. Thread Protocol Implementation and Communication Flow

Communication between the constrained edge nodes and the fog gateway utilizes the Constrained Application Protocol (CoAP) over UDP.

*   **Payload Encoding:** To minimize RF transmission time and bandwidth, raw telemetry is aggressively serialized into Concise Binary Object Representation (CBOR) utilizing the `zcbor` library.
*   **Transmission Interval:** Nodes sample their sensors every 6 seconds but only transmit a batch of 5 samples every 30 seconds (`TRANSMIT_INTERVAL_MS = 30000`). This bulk transmission drastically reduces radio activation overhead.
*   **CoAP Reliability:** Nodes transmit using CoAP PUT requests to the `storedata` URI. The firmware executes a blocking `poll()` for up to 5,000 ms waiting for an explicit CoAP ACK from the gateway. If the ACK is not received, the transmission is marked as failed.
*   **Network Degration:** Upon 3 consecutive transmission failures (`MAX_CONSECUTIVE_FAILURES = 3`), the node aggressively restarts its OpenThread stack (`otThreadSetEnabled(false -> true)`) to force a topology recalculation and find a healthier parent.

---

## 3. Statistical Methods, Calculations, and Performance Analysis

To prevent the central backend from being overwhelmed by high-frequency noise, the Zephyr edge node natively performs statistical aggregation.

*   **Circular Buffer:** Telemetry is stored in a rolling circular buffer of 30 samples (`SENSOR_STATS_BUFFER_SIZE`).
*   **Edge Statistics:** For every 30-second transmission batch, the node calculates the **Mean**, **Standard Deviation**, and **Maximum** for 9 separate sensor channels (e.g., CO2, TVOC, PM2.5, Temperature, Humidity).
*   **Two-Pass Variance:** Standard deviation is calculated natively on the embedded node using a rigorous two-pass algorithm: `std = sqrt(sum((x - mean)^2) / n)`.
*   **Payload Output:** The final CBOR payload consists of a 37-dimensional feature vector: 10 raw hardware measurements appended with the 27 calculated statistical aggregations.
*   **Execution Latency:** Sensor reads are abstracted behind mutually exclusive locks (`k_mutex`). The main loop acquires the lock, performs a rapid struct copy, and releases it, ensuring the main execution thread never blocks for more than 1 millisecond.

---

## 4. Threshold Values Used Throughout the System

The backend architecture incorporates deterministic thresholds strictly aligned with public health and safety standards.

*   **Temperature:** Healthy range bounded between 19°C and 28°C. Critical thresholds are defined at **< 10°C** and **> 35°C**.
*   **Carbon Dioxide (CO2):** The absolute critical threshold is set at **> 1500 ppm**.
*   **Particulate Matter (PM2.5):** The 24-hour critical hazard threshold is set at **> 35 µg/m3**.
*   **Total Volatile Organic Compounds (TVOC):** The chronic exposure hazard limit is set at **> 1000 ppb**.
*   **Hardware Noise Floors:** Used by the heuristic engine to prevent micro-fluctuations from triggering false positives.
    *   SCD41 Temperature Floor: **± 0.2°C**
    *   SCD41 CO2 Floor: **± 30 ppm**
    *   CCS811 TVOC Floor: **± 25 ppb**
    *   SPS30 PM2.5 Floor: **± 5 µg/m3**

---

## 5. References, Standards, and Research Justification

The thresholds outlined above are not arbitrary; they are strictly mapped to the following international guidelines:

1.  **ASHRAE Standard 55**: "Thermal Environmental Conditions for Human Occupancy". Defines the absolute physiological bounds for human thermoregulation (< 10°C leading to hypothermia/pneumonia, > 35°C leading to heat stroke).
2.  **ASHRAE Standard 62.1**: "Ventilation for Acceptable Indoor Air Quality". Establishes the 1500 ppm limit for CO2 to prevent severe cognitive impairment and fatigue.
3.  **WHO Global Air Quality Guidelines / U.S. EPA**: Establishes the > 35 µg/m3 limit for fine particulate matter (PM2.5) to prevent acute cardiovascular and respiratory strain.
4.  **WELL Building Standard v2**: Utilized to establish the > 1000 ppb threshold for TVOCs, a known indicator of outgassing from toxic building materials and cleaning agents.

---

## 6. Alert Types, Triggering Conditions, and Response Mechanisms

The Java Spring Boot backend utilizes a Multi-Engine Alert heuristic pipeline to distinguish between transient anomalies (e.g., breath or cleaning aerosols) and sustained hazards (e.g., HVAC failure or fires).

*   **Static Alerts (`TEMPERATURE_HIGH`, `CO2_HAZARD`):** Triggered immediately when raw values breach the absolute health standards (e.g., CO2 > 1500 ppm).
*   **Transient VOC Alert:** A heuristic designed to detect rapidly dispersing aerosols (e.g., hand sanitizer). It triggers if the maximum VOC reading in the rolling window is at least 1.5 standard deviations above the mean (clamped to the 25 ppb noise floor): `VOC_max > VOC_mean + max(1.5 * VOC_std, 25)`.
*   **Multi-Sensor Fusion (Cleaning Event):** A heuristic combining multiple sensor vectors. It requires both TVOC and PM2.5 to simultaneously register a 3-sigma anomaly spike above their respective noise floors, characteristic of dusting or chemical aerosol sprays.
*   **Debouncing Mechanism:** To prevent alert storms, the backend utilizes a distributed Redis `SETNX` lock with a 300-second Time-To-Live (TTL). Once an alert of a specific type is fired for a specific node, duplicate alerts are completely suppressed for 5 minutes.

---

## 7. Mathematical Models and Formulas Used in the System

The isolated Machine Learning microservice operates on a 12-dimensional vector (5 base features, 5 rate-of-change, 2 temporal) and employs unsupervised learning to identify context-specific anomalies.

*   **Robust Scaling:** Standard normalization (mean/std) is highly vulnerable to outliers. The system employs robust scaling using Medians and the Interquartile Range (IQR):
    `Scaled_Value = (X - Median) / max(IQR, 1e-9)`
*   **Isolation Forest:** The core anomaly engine relies on Scikit-Learn's `IsolationForest`. It isolates anomalies using random recursive partitioning. The contamination parameter is set to `"auto"`, allowing the model to adapt dynamically to the room's natural variance.
*   **Explainable AI (XAI):** The system attributes anomaly scores in real-time by calculating the absolute Z-score of each scaled feature and selecting the feature with the highest deviation as the primary root cause.
*   **Drift Detection:** A Kolmogorov-Smirnov (K-S) statistical test evaluates long-term distribution shifts. If the K-S drift threshold exceeds **0.25** and variance is low, it triggers an autonomous model retraining cycle.
*   **Exponential Moving Average (EMA):** Used by the forecaster to smooth high-frequency noise before linear projection: 
    `EMA_current = (0.25 * Current_Value) + (0.75 * EMA_previous)`
*   **Forecaster Gating:** Linear regression projections are automatically aborted if the R-Squared correlation coefficient drops below **0.65**, preventing wild predictions during turbulent air states.

---

## 8. Reliability Analysis, Error Handling, and Fault Tolerance

The SSNS is engineered to survive severe network partitions and hardware degradation without requiring manual intervention.

*   **Edge RAM Queuing:** The Zephyr node maintains a circular array capable of storing 50 transmission packets. At 1 batch per 30 seconds, this provides exactly 25 minutes of complete offline data coverage during network failure.
*   **Sensor Hardware Sentinels:** If an I2C sensor bus hangs or fails, the thread clears its specific bit in the 8-bit `health_mask` and sets its telemetry value to a sentinel of `-999.0`.
*   **Warm-up Sentinels:** The CCS811 requires a 20-minute thermal warmup. During this phase, values are set to `-998.0` to prevent false positive anomalies during hardware calibration.
*   **Median-Decay Imputation:** If the ML service receives a missing or sentinel value, it does not crash. It imputes the missing data using a duration-based decay formula that slowly reverts the value toward the historical room median:
    `Decay_Factor = exp(-0.000385 * Duration_Seconds)`
*   **Fog Store-and-Forward:** The Python gateway utilizes Redis `LPUSH` and `LPOP` commands. If the HTTP connection to the central API goes down, it buffers packets locally. Upon failure, it invokes an exponential backoff retry mechanism: `delay = min(3600, 2^current_retry)`.

---

## 9. Network and Deployment Architecture

The entire platform layer is containerized and orchestrated utilizing Docker and Docker Compose.

*   **Decoupled Services:** The system defines isolated services for the API (`api-1`, `api-2`), the ML engine (`ml-service`), the MongoDB database (`mongodb`), the Redis cache (`redis`), the React Dashboard (`dashboard`), and the Nginx reverse proxy (`nginx`).
*   **Load Balancing:** Nginx operates as a Layer 7 load balancer. It terminates client connections and distributes incoming HTTP requests across the duplicated `api-1` and `api-2` Spring Boot containers using a round-robin strategy.
*   **Internal Networking:** Services communicate securely over isolated Docker bridge networks. The database and Redis instances do not expose their internal ports to the host machine, preventing external tampering.
*   **Observability Probes:** Docker Compose executes explicit health checks (e.g., `wget -qO- http://localhost:8080/actuator/health`). Services define strict `depends_on: condition: service_healthy` blocks to guarantee correct startup ordering (e.g., the API will not boot until MongoDB passes its `mongosh` ping test).
