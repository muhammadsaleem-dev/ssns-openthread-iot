--------------------------------------------------------

Document name: architecture-overview.md

Purpose: Provides a high-level summary of the end-to-end 6-tier architecture (Edge, Fog, Backend, Database, ML, Frontend).

Important information: The system is designed for high availability and low latency, utilizing a decoupled microservice approach. The Edge uses IEEE 802.15.4 and CoAP; Fog translates CoAP to HTTP POST; Backend processes and broadcasts via WebSockets; Database uses MongoDB; ML uses Python/FastAPI; Frontend uses React. Deployment is containerized via Docker Compose. Load balancing uses Nginx. Single points of failure exist at MongoDB and Nginx. No Kubernetes support currently.

Important formulas: None explicitly stated here.

Important thresholds: None explicitly stated here.

Important standards: IEEE 802.15.4, IPv6, HTTP, CoAP.

Potential figures: End-to-End Data Flow, Overall architecture.

Potential references: None specific.

--------------------------------------------------------

Document name: edge-node.md

Purpose: Details the embedded firmware architecture of the sensor nodes running Zephyr RTOS on nRF52840.

Important information: Decouples physical I/O from network transmission. Uses a Dual-Mode Abstraction (Hardware vs Simulation). Employs background asynchronous polling with three dedicated threads (SCD41 at 5.5s, CCS811 at 1.0s, SPS30 at 1.5s). Data aggregated via a Zephyr Mutex. Compresses statistics into CBOR batches. Transmits every 30s over OpenThread via CoAP (UDP/IPv6). Maintains a 50-packet RAM queue (25 mins of buffering) for offline fault tolerance.

Important formulas: Naive two-pass standard deviation.

Important thresholds: 60s warm-up; 6s sampling; 30s batch TX; 50-packet RAM buffer limit.

Important standards: CoAP, CBOR, OpenThread, IEEE 802.15.4, I2C.

Potential figures: OpenThread topology.

Potential references: Zephyr Project RTOS API Reference, OpenThread Specification.

--------------------------------------------------------

Document name: fog-tier.md

Purpose: Describes the bridge between the 802.15.4 Thread mesh and the IPv4/IPv6 IP backend, orchestrating OTBR and Python gateway services.

Important information: Contains OTBR container (attached to /dev/ttyACM0), Gateway container, and Redis container. Uses host networking. Decodes CoAP/CBOR. Reconstructs timestamps. Uses Redis `SETNX` for deduplication and `LPUSH`/`LPOP` for HA queueing. Handles HTTP POST forwarding to the backend. Uses exponential backoff for retries. Monitors topology via `ot-ctl`.

Important formulas: Exponential backoff: `delay = min(3600, 2 ** current_retry)`.

Important thresholds: 300-second TTL for deduplication.

Important standards: CoAP, CBOR, HTTP.

Potential figures: Communication workflow.

Potential references: None specific.

--------------------------------------------------------

Document name: backend-tier.md

Purpose: Details the Java Spring Boot stateless backend responsible for telemetry ingestion, data storage, WebSockets, and alert evaluation.

Important information: Utilizes Spring Boot, MongoDB (highly denormalized for write speed), and WebSockets for real-time dashboard updates. Features a multi-engine alerting architecture (Static, Heuristic, Hardware, External ML). Uses Nginx for load balancing. Resolves alerts via manual or automatic self-healing. Implements a 300s distributed debounce to prevent UI spam.

Important formulas: 
- Sustained CO2: `CO2 > CO2max AND CO2mean > 0.8 * CO2max AND CO2std < 150`
- Transient VOC: `VOCmax > VOCmean + max(1.5 * VOCstd, 25)`
- Cleaning event: `VOCmax > VOCmean + max(3 * VOCstd, 25) AND PMmax > PMmean + max(3 * PMstd, 5)`
- Ventilation: `Temp < Tempmean - max(2 * Tempstd, 0.8)`
- Combustion: `PM2.5 > 35 AND TVOC > 1000 AND Temp > Tempmean + (2 * Tempstd)`

Important thresholds: CO2 max: 1500 ppm; PM2.5 max: 35 µg/m3; Temp max: 35°C; Temp min: 10°C; Humidity max: 60% RH; Humidity min: 20% RH; TVOC combustion: 1000 ppb; Occupancy CO2 mean: 800 ppm.

Important standards: ASHRAE 55, ASHRAE Position Document on Indoor CO2, OSHA, WHO/EPA, WELL v2.

Potential figures: Alert workflow.

Potential references: ASHRAE guidelines, OSHA guidelines, WHO guidelines, EPA guidelines, WELL v2.

--------------------------------------------------------

Document name: ml-service.md

Purpose: Details the Python/FastAPI microservice for advanced anomaly detection and predictive forecasting.

Important information: Uses a pull-based asynchronous poller. Extracts a 12-dimensional feature vector (Base, Rate-of-Change, Temporal Sine/Cosine). Uses Robust Scaling (Median/IQR). Core algorithm is Isolation Forest (contamination="auto"). Handles drift detection via Kolmogorov-Smirnov test. Forecasts using Exponential Moving Average (EMA) and linear regression. Uses Z-scores for explainability (XAI). Applies duration-tiered imputation for self-healing missing values: LOCF under 5 minutes, damped median-decay from 5-60 minutes, full median masking beyond 60 minutes.

Important formulas: 
- Robust Scaling: `X_scaled = (X - Median) / max(IQR, 1e-9)`
- K-S Drift: `D_KS = Max(|Interpolated Baseline - Recent Data|) / (Max(Baseline) - Min(Baseline))`
- EMA: `(0.25 * Current Value) + (0.75 * Previous EMA)`
- Imputation Decay: `exp(-0.000385 * Duration_Seconds)`

Important thresholds: K-S Threshold: 0.25; R-Squared threshold: 0.65; contamination factor: "auto"; warm-up window: 20-40 samples.

Important standards: None specific.

Potential figures: Machine-learning pipeline.

Potential references: Scikit-Learn documentation.

--------------------------------------------------------

Document name: frontend-tier.md

Purpose: Describes the React-based Single Page Application dashboard.

Important information: Built with React, Vite, Material UI, Recharts, and React Flow. Uses state-based routing. Connects via Axios (REST) and WebSockets (real-time telemetry). Reconnection logic is built into WebSockets. Limits telemetry array to 10,000 records to prevent memory leaks in the browser. Uses insecure localStorage authentication (limitation).

Important formulas: None.

Important thresholds: 10,000 record slice limit for WebSocket stream.

Important standards: WebSocket, REST.

Potential figures: Dashboard.

Potential references: None specific.

--------------------------------------------------------

Document name: threshold-traceability.md & design-decisions.md

Purpose: Provides justification and traceability for all configured environmental rules.

Important information: Raw data is smoothed over 30 samples to eliminate 1-second noise. Clamps statistical variance to absolute physical hardware noise floors (e.g., SCD4x ±0.8°C, CCS811 ±25ppb) to stop false positives in clean air. Fuses multiple vectors (e.g., Temp+PM+TVOC) to isolate fires from cleaning spray. 

Important formulas: As documented in backend-tier.md.

Important thresholds: 
- temperatureMax: 35.0 °C (ASHRAE 55)
- temperatureMin: 10.0 °C (ASHRAE 55)
- humidityMax: 60.0 % RH (OSHA)
- humidityMin: 20.0 % RH (OSHA)
- co2Max: 1500.0 ppm (ASHRAE Position Document on Indoor CO2)
- pm25Max: 35.0 µg/m³ (EPA)
- tvocMax: 1000.0 ppb (WELL v2)
- occupancy_co2_mean: 800.0 ppm (Empirical)
- Fault placeholder: -999.0

Important standards: ASHRAE 55, ASHRAE Position Document on Indoor CO2, OSHA, WHO Air Quality, EPA, WELL v2 Building Standard.

Potential figures: None.

Potential references: ASHRAE 55, ASHRAE Position Document on Indoor CO2, OSHA, WHO, EPA, WELL v2.

--------------------------------------------------------
