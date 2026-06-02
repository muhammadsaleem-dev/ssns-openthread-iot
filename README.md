# Smart Sensor Network System (SSNS)

**High-Availability OpenThread IoT Platform** — an industrial-grade, full-stack ecosystem for environmental telemetry ingestion, real-time monitoring, and ML-driven anomaly detection.

This repository is a fully integrated **Monorepo** featuring a distributed **Fog-to-Core** architecture designed for resilience, scalability, and zero-data-loss ingestion.

## 🏗️ Architecture

The system is engineered for **End-to-End High Availability (HA)** across four distinct tiers:

### 1. The Edge (Sensors)
*   **nRF52840 Nodes:** Running Zephyr RTOS, utilizing **CoAP Confirmable (CON)** messages.
*   **Resilience:** Implements local **NVS (Non-Volatile Storage) caching**, allowing sensors to store data locally if the Fog tier is unreachable.

### 2. The Fog Tier (Distributed Receivers)
*   **Autonomous Fog Nodes:** Can be deployed on **Mac, Native Linux (Raspberry Pi), or Windows (via WSL2)**.
*   **Heterogeneous Support:** Proves the system is platform-agnostic; fog nodes process data identically on native and virtualized Linux kernels.
*   **Redundancy:** Utilizes OpenThread **ALOC (Anycast Locator)** routing; sensors automatically find the nearest healthy gateway.
*   **Local Processing:** Each fog node runs a local **OTBR**, **Python Gateway**, and **Redis buffer** to ensure autonomy during network outages.

### 3. The Bridge Tier (Distributed Queue)
*   **Redis-Backed Ingest:** Replaced local SQLite with a centralized/distributed **Redis queue** for sub-millisecond deduplication and resilient store-and-forward logic.

### 4. The Platform Tier (Central Core)
*   **Load Balanced API:** 2x redundant **Spring Boot** instances behind an **Nginx Load Balancer**.
*   **Resilient Ingress:** Dual-mode Nginx proxies handling both **HTTP (API)** and **UDP (CoAP)** traffic.
*   **Intelligent Analytics (ML Service):** A Python FastAPI service that provides isolation-forest anomaly detection and proactive CO2 forecasting.
*   **Unified UI:** React Dashboard providing a single source of truth from a centralized **MongoDB** instance.

## 🛡️ Reliability & High Integrity Features
*   **High-Integrity Timing:** Employs a **30-second decompressed loop** with a 12-second hardware-latency simulation, ensuring OpenThread radio stack stability during blocking sensor acquisition.
*   **Self-Healing Hardware Link:** Uses a custom **Windows Serial Bridge** with auto-attach logic and a 5-second CoAP ACK failover window.
*   **Actionable Diagnostics:** Implements a binary **Health Vector** (bitmask) to provide sensor-specific fault alerts (e.g., "SCD41 Failure: Check I2C Wiring") instead of generic error codes.
*   **Fail-Safe ML:** Features a **Pre-Inference Sanity Filter** that detects hardware fault flags (-999.0) and automatically suppresses ML inference to prevent "data poisoning" of the Isolation Forest models.
*   **Active-Active Failover:** Both Gateways and APIs share the load via **Nginx `least_conn` load balancing**; the system survives multiple container crashes.
*   **Self-Healing Uplink:** Fog nodes automatically flush their Redis buffers to the **Platform Core** the moment connectivity (Wi-Fi/Tailscale) is restored.

## 🚀 Getting Started

### 1. Platform Core (Mac/Linux)
To launch the high-availability backend stack:
```bash
make start-platform
```

### 2. Distributed Fog Nodes (Windows/Pi)
To set up an autonomous edge node on a different machine (e.g., Windows), see the detailed guide:
👉 **[Windows Fog Node Setup Guide](edge-nodes/windows-otbr/WINDOWS_FOG_SETUP.md)**

## 🚧 Cross-Platform Implementation Notes
*   **macOS Kernel Compatibility:** To overcome the absence of `CONFIG_IP_MROUTE` in the Docker Desktop for Mac kernel, we utilize a **custom-compiled OTBR image** with specialized build-flags to ensure stability.
*   **Hardware Abstraction:** Due to macOS hardware mapping limitations, we implemented a **Socket-to-Serial bridge** to securely connect the physical nRF52840 radio to the containerized environment.

## 🛠️ Repository Organization

```text
ssns-project/
├── platform/                 ← Platform Tier (Central Core): API, Dashboard, ML, Redis, MongoDB
├── edge-nodes/               ← Fog Tier: OTBR and Gateway configurations (Mac/Windows)
├── firmware/                 ← Edge Tier: Zephyr C codebase & Hex files
├── docs/                     ← Architectural diagrams and setup guides
└── Makefile                  ← Cross-tier orchestration shortcuts
```
