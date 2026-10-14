# Smart Sensor Network System (SSNS)
### Thread-Based Intelligent Indoor Environmental Monitoring Platform

[![IEEE Format](https://img.shields.io/badge/Paper-IEEE%20Format-blue?style=for-the-badge&logo=ieee)](docs/01-final-deliverables/report/ieee-report.pdf)
[![OpenThread](https://img.shields.io/badge/Mesh-OpenThread%20802.15.4-blueviolet?style=for-the-badge&logo=openthread)](https://openthread.io/)
[![Zephyr RTOS](https://img.shields.io/badge/RTOS-Zephyr%20v3.x-lightgrey?style=for-the-badge&logo=nordicsemiconductor)](https://zephyrproject.org/)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203-brightgreen?style=for-the-badge&logo=springboot)](platform/api)
[![FastAPI](https://img.shields.io/badge/ML%20Service-FastAPI%20%2F%20Scikit--Learn-darkgreen?style=for-the-badge&logo=fastapi)](platform/ml-service)
[![React Dashboard](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61dafb?style=for-the-badge&logo=react)](platform/dashboard)

> **Sole Author & Lead Engineer:** **Muhammad Saleem**  
> *M.Sc. High Integrity Systems, Frankfurt University of Applied Sciences, Germany*

---

## 🌟 Executive Summary

The **Smart Sensor Network System (SSNS)** is an industrial-grade, distributed IoT ecosystem engineered for mission-critical indoor air quality (IAQ) and life-safety monitoring. Moving beyond standard single-parameter alarms or cloud-dependent sensor hubs, SSNS unifies:

1. **IPv6 OpenThread 802.15.4 Mesh Networking:** Self-healing, multi-hop radio infrastructure running Zephyr RTOS on Nordic nRF52840 hardware.
2. **Heterogeneous Fog Tier:** Autonomous edge gateways (Linux & macOS) providing protocol translation, deduplication, and store-and-forward persistence.
3. **Multi-Engine Alert Pipeline:** High-speed parallel evaluation across deterministic thresholds (ASHRAE, OSHA, WHO, EPA, WELL v2), noise-floor-clamped rolling heuristics, and hardware health bitmasks.
4. **Machine Learning & Predictive Intelligence:** An unsupervised Isolation Forest anomaly detection engine with dynamic drift adaptation (Kolmogorov-Smirnov) and $R^2$-gated trend forecasting.
5. **Historical Topology Scrubber & Temporal State Playback:** Deterministic auditing and frame-by-frame visual verification of OpenThread self-healing, dynamic role promotions, and leader elections.

---

## 🧭 System Architecture

```text
       PHYSICAL SENSOR SUITE
    [SCD41]    [SPS30]    [CCS811]
     (CO2)    (PM1/2.5/10) (TVOC)
       │          │          │
       └───┬──────┴──────┬───┘
           ▼ (I2C Async Mutex)
  ┌─────────────────────────────────┐
  │  Nordic nRF52840 (Zephyr RTOS)  │  <-- Dual-Mode (Hardware / Sim)
  │  - 27-Point Running Statistics  │  <-- 50-Packet RAM Offline Queue
  │  - CBOR Compressed Telemetry    │  <-- Router-Eligible FTD Node
  └────────────────┬────────────────┘
                   │
                   ▼ (IEEE 802.15.4 / CoAP CON / IPv6)
  ┌────────────────────────────────────────────────────────┐
  │         OpenThread Self-Healing Mesh Cluster           │
  │   [Child Node] ◄──(Role Promotion)──► [Router Node]   │
  └────────────────────────┬───────────────────────────────┘
                           │ (ALOC Routing)
                           ▼
  ┌────────────────────────────────────────────────────────┐
  │       Heterogeneous Fog Gateway (OTBR + Python)        │
  │   - CoAP Server (aiocoap) + CBOR Decompressor          │
  │   - Redis SETNX Deduplication & LPUSH Outage Queue     │
  └────────────────────────┬───────────────────────────────┘
                           │ (HTTP / JSON REST)
                           ▼
  ┌────────────────────────────────────────────────────────┐
  │            Ingress & Load Balancing Tier               │
  │   - Nginx Reverse Proxy (L7 Round-Robin / Failover)    │
  └────────────────────────┬───────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│  Spring Boot Core API     │ │  FastAPI Machine Learning │
│  - Alert Engine (Rules)   │ │  - 12D Isolation Forest   │
│  - WebSocket Broadcaster  │ │  - KS Drift Detector      │
│  - Topology History Store │ │  - R²-Gated Forecaster    │
└─────────────┬─────────────┘ └─────────────┬─────────────┘
              │                             │
              ▼                             ▼
       [MongoDB NoSQL]              [XAI Insights]
              │
              ▼ (WebSockets / REST)
┌──────────────────────────────────────────────────────────┐
│        React Operations Center & SCADA Dashboard         │
│  - Real-Time Live Telemetry (Recharts)                   │
│  - React Flow Dynamic Multi-Hop Topology Graph           │
│  - Historical Topology Scrubber & Temporal State Playback │
└──────────────────────────────────────────────────────────┘
```

---

## ⏱️ Historical Topology Scrubber & Temporal State Playback

Developed to empirically validate autonomous mesh resilience, the **Topology Scrubber** enables operators to audit and reconstruct chronological network topology states deterministically.

```text
 ◀◀ [ PLAY / PAUSE ] ▶▶  ───[ Timeline Slider: Snapshots 0 ... N ]───  [ ⟲ LIVE SNAP ]
                               │           │             │
                               🔴          🟠            🟣
                          Gateway Outage  Leader    Self-Healing:
                           (Down/Up)     Election  Child ➔ Router
```

### Key Technical Capabilities:
* **Frame-by-Frame Topology Auditing:** The Spring Boot backend continuously records multi-node network states into MongoDB (`NetworkTopologyHistory`), capturing node roles (`LEADER`, `ROUTER`, `CHILD`, `DETACHED`), route costs, link qualities, and gateway health.
* **Automated Differential Event Markers:** The frontend timeline scans adjacent frames and highlights critical occurrences with color-coded markers:
  * 🔴 **Red Marker:** Edge gateway outage or recovery transition.
  * 🟠 **Orange Marker:** Thread Leader election resulting from partitions or re-elections.
  * 🟢 / ⚪ **Green/Grey Marker:** Nodes joining or ungracefully dropping from the mesh.
  * 🟣 **Purple Marker (Self-Healing Promotion):** Directly captures OpenThread's self-healing role transitions (e.g., when a `Child` node automatically promotes itself to a `Router` to maintain packet paths during node dropouts).
* **Smooth Playback & Dynamic Visualization:** Operators can play back network events at configurable speeds or scrub directly to points of interest. Nodes visually pulse to indicate leader authority, and link lines update dynamically with empirical quality percentages without DOM thrashing or transient edge crashes.

---

## 🔬 Core Subsystems & Technical Rigor

### 1. Embedded Firmware & Hardware Tier ([`firmware/`](firmware))
* **Microcontroller:** Nordic Semiconductor nRF52840 running Zephyr RTOS v3.x.
* **Sensor Suite:** 
  * **Sensirion SCD41:** Photoacoustic NDIR $\text{CO}_2$ ($400 - 5000\text{ ppm}$, $\pm(50\text{ ppm} + 3\%)$).
  * **Sensirion SPS30:** Laser scattering particulate counter ($\text{PM}_{1.0}, \text{PM}_{2.5}, \text{PM}_{4.0}, \text{PM}_{10}$).
  * **ScioSense CCS811:** Metal-oxide TVOC sensor ($0 - 1187\text{ ppb}$).
* **Hardware Producer-Consumer Model:** Dedicated Zephyr threads poll I2C sensors at hardware-native rates (1.0s to 5.5s), computing 27-element statistical vectors (Mean, Max, StdDev) in shared memory under Mutex locks before CoAP transmission.
* **Offline Fault Tolerance:** On-chip 50-packet volatile RAM buffer providing **25 minutes of continuous data retention** during complete radio or gateway blackout.

### 2. Fog Computing Layer ([`edge-nodes/`](edge-nodes))
* **Border Router (OTBR):** Connects the 802.15.4 radio mesh to standard IPv6 networks.
* **Autonomous Python Gateway:** Asynchronous `aiocoap` listener decompressing CBOR payloads.
* **Zero-Loss Queueing:** Redis-backed `SETNX` deduplication (300s TTL) and exponential backoff retry queue (`LPUSH`/`LPOP`) ensuring zero dropped packets during WAN disconnections.
* **Heterogeneous Cross-Platform Support:** Validated on native Linux, macOS (with custom socket-serial bridge), and Windows WSL2.

### 3. Backend & Multi-Engine Alerting Platform ([`platform/api`](platform/api))
* **Java 17 / Spring Boot 3:** High-throughput, stateless ingestion microservices horizontally scalable behind Nginx.
* **Parallel Alert Engines:**
  * **Static Engine:** Enforces international health bounds: $\text{CO}_2 > 1500\text{ ppm}$ (ASHRAE), $\text{PM}_{2.5} > 35\ \mu\text{g/m}^3$ (EPA NAAQS), $\text{TVOC} > 1000\text{ ppb}$ (WELL v2), Temperature $10^\circ\text{C} - 35^\circ\text{C}$ (ASHRAE 55), Humidity $20\% - 60\%$ (OSHA).
  * **Heuristic Engine:** Evaluates rolling 30-sample statistics clamped against sensor physical noise floors; detects rapid VOC spikes ($1.5\sigma$) and multi-sensor fusion cleaning events.
  * **Hardware Engine:** Evaluates 8-bit sensor health status masks and isolates sentinel errors (-999.0).
  * **Distributed Debounce:** 300-second suppression window preventing cascading alert storms.

### 4. Machine Learning & Forecasting Service ([`platform/ml-service`](platform/ml-service))
* **Unsupervised Anomaly Detection:** Scikit-Learn **Isolation Forest** operating on a 12-dimensional feature space (5 primary sensor channels, 5 first-order rate-of-change derivatives, 2 cyclical temporal encodings).
* **Drift Adaptation:** Two-sample Kolmogorov-Smirnov statistical test ($p < 0.25$) triggering robust median/IQR normalization rescaling without destabilizing the ensemble tree structures.
* **Explainable AI (XAI):** Real-time Z-score attribution isolating the exact physical sensor driving each anomaly.
* **Trend Forecaster:** Linear trend projection with $R^2 \ge 0.65$ correlation gating and EMA smoothing over 30-minute horizons.

---

## 📊 Empirical Evaluation Summary

Results evaluated across 2.8-day continuous real-room empirical telemetry:

| Metric | Result | Target Benchmark |
| :--- | :--- | :--- |
| **True Positive Rate (TPR)** | **77.31%** | $> 75\%$ on safety breaches |
| **False Positive Rate (FPR)** | **0.45%** | $< 1.0\%$ operational false alarms |
| **Detection Latency ($\text{CO}_2$)** | **584 seconds** | Within 900s hazardous ramp |
| **Partition Self-Healing** | **100% Autonomous** | Zero manual operator intervention |
| **Edge RAM Queue Coverage** | **25 Minutes** | Full packet preservation |

---

## 🚀 Quick Start Guide

### Prerequisites
* Docker & Docker Compose v2.x
* Java 17+ & Maven (for native backend build)
* Node.js v18+ & npm (for dashboard)
* Python 3.10+ (for ML service and gateway)

### 1. Launch Platform Core via Docker Compose
```bash
# Clone the repository
git clone https://github.com/muhammadsaleem-dev/ssns-openthread-iot.git
cd ssns-openthread-iot

# Start MongoDB, Redis, API replicas, ML service, and Dashboard
docker compose -f platform/docker-compose.ha.yml up -d
```

### 2. Access Web Dashboard
Open your browser and navigate to:
* **Dashboard & Topology Scrubber:** `http://localhost:3000`
* **Spring Boot API Swagger/Health:** `http://localhost:8080/actuator/health`
* **ML Service Docs:** `http://localhost:8000/docs`

### 3. Run Reliability & Chaos Test Suite
To stress-test fault-tolerance, dynamic leader failover, and queue recovery:
```bash
# Execute chaos engineering suite
./chaos_stress_test.sh

# Run end-to-end alert verification
./test_static_alerts.sh
```

---

## 📑 Academic Documentation & References

| Document | Format | Description |
| :--- | :--- | :--- |
| [**Final IEEE Conference Report**](docs/01-final-deliverables/report/ieee-report.pdf) | PDF (9 Pages) | Formal academic paper with mathematical models, architecture, and empirical evaluation |
| [**LaTeX Source Code**](docs/01-final-deliverables/report/ieee-report.tex) | LaTeX (.tex) | Full IEEEtran formatted publication source |
| [**AI Interaction Appendix**](docs/01-final-deliverables/ai-interaction/ai-usage-appendix.pdf) | PDF (8 Pages) | Detailed audit of AI assistant engineering usage and verification workflows |
| [**Hardware Wiring Blueprint**](docs/03-hardware/wiring.md) | Markdown | Complete I2C pin mapping, power considerations, and board schematics |
| [**System Documentation Index**](docs/README.md) | Markdown | Detailed directory of all subsystem technical specifications |

---

## 👨‍💻 Author

**Muhammad Saleem**  
*M.Sc. High Integrity Systems*  
Frankfurt University of Applied Sciences, Frankfurt am Main, Germany  
Contact: [muhammad.saleem2@stud.fra-uas.de](mailto:muhammad.saleem2@stud.fra-uas.de)  
GitHub: [@muhammadsaleem-dev](https://github.com/muhammadsaleem-dev)
