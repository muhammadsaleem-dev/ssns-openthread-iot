# Smart Sensor Network System (SSNS)

**High-Availability OpenThread IoT Platform** — an industrial-grade, full-stack ecosystem for environmental telemetry ingestion, real-time monitoring, and ML-driven anomaly detection.

This repository is a fully integrated **Monorepo** featuring a distributed **Fog-to-Core** architecture designed for resilience, scalability, and zero-data-loss ingestion.

## 🏗️ Architecture

The system is engineered for **End-to-End High Availability (HA)** across four distinct tiers:

### 1. The Edge (Sensors)
*   **nRF52840 Nodes:** Running Zephyr RTOS, utilizing **CoAP Confirmable (CON)** messages.
*   **Resilience:** Implements local **NVS (Non-Volatile Storage) caching**, allowing sensors to store data locally if the Fog tier is unreachable.

### 2. The Fog Tier (Distributed Receivers)
*   **Autonomous Fog Nodes:** Can be deployed on **Mac, Windows (WSL2), or Raspberry Pi**.
*   **Redundancy:** Utilizes OpenThread **ALOC (Anycast Locator)** routing; sensors automatically find the nearest healthy gateway.
*   **Local Processing:** Each fog node runs a local **OTBR**, **Python Gateway**, and **Redis buffer** to ensure autonomy during network outages.

### 3. The Bridge Tier (Distributed Queue)
*   **Redis-Backed Ingest:** Replaced local SQLite with a centralized/distributed **Redis queue** for sub-millisecond deduplication and resilient store-and-forward logic.

### 4. The Core Tier (High-Availability Cloud)
*   **Load Balanced API:** 2x redundant **Spring Boot** instances behind an **Nginx Load Balancer**.
*   **Resilient Ingress:** Dual-mode Nginx proxies handling both **HTTP (API)** and **UDP (CoAP)** traffic.
*   **Intelligent Analytics (ML Service):** A Python FastAPI service that provides:
    *   **Anomaly Detection:** Uses **Isolation Forest** (unsupervised learning) to identify multi-variable environmental deviations that simple thresholds miss.
    *   **Predictive Forecasting:** Uses rolling-window **Linear Regression** to project CO2 and PM2.5 levels 30 minutes into the future, enabling proactive intervention.
    *   **Contextual Alerts:** Automatically pushes ML-driven alerts back to the central API for dashboard display.
*   **Unified UI:** React Dashboard providing a single source of truth from a centralized **MongoDB** instance.

## 🚀 Getting Started

### 1. Core Server (Mac/Linux)
To launch the high-availability backend stack:
```bash
make start-platform
```

### 2. Distributed Fog Nodes (Windows/Pi)
To set up an autonomous edge node on a different machine (e.g., Windows), see the detailed guide:
👉 **[Windows Fog Node Setup Guide](edge-nodes/windows-otbr/WINDOWS_FOG_SETUP.md)**

## 🛡️ Reliability Features
*   **Active-Active Failover:** Both Gateways and APIs share the load; the system survives multiple container crashes.
*   **Self-Healing Uplink:** Fog nodes automatically flush their Redis buffers to the Cloud the moment connectivity (Wi-Fi/Tailscale) is restored.
*   **Smart Deduplication:** Redis `SETNX` logic prevents duplicate radio packets from polluting the database.

## 🛠️ Repository Organization

```text
ssns-project/
├── platform/                 ← Core Tier: API, Dashboard, ML, Redis, MongoDB
├── edge-nodes/               ← Fog Tier: OTBR and Gateway configurations (Mac/Windows)
├── firmware/                 ← Edge Tier: Zephyr C codebase & Hex files
├── docs/                     ← Architectural diagrams and setup guides
└── Makefile                  ← Cross-tier orchestration shortcuts
```
