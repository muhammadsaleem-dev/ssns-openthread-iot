# Smart Sensor Network System (SSNS)

**OpenThread-Based Smart Indoor Environmental Monitoring System** — a full-stack IoT platform for environmental telemetry ingestion, real-time monitoring, and machine learning anomaly detection.

This repository is a fully integrated **Monorepo** containing the embedded Zephyr firmware, the Dockerized edge node border routers (Mac & Windows), and the central cloud backend.

## 🏗️ Architecture

The system is broken down into three main layers:

### 1. `firmware/` (The Physical Layer)
*   **`sensor-node`**: Zephyr RTOS C++ application running on battery-powered Nordic nRF52840 DKs. These nodes gather environmental data (Temperature, Humidity) and transmit it securely over an IPv6 OpenThread mesh network using CoAP (UDP).
*   **`border-router-rcp`**: Zephyr source code for the Radio Co-Processor firmware.
*   **`rcp-hex-files`**: Pre-compiled Radio Co-Processor firmware for the nRF52840 USB Dongles.

### 2. `edge-nodes/` (The Network Edge)
*   **`mac-otbr` & `windows-otbr`**: OpenThread Border Routers (OTBR) running inside Docker. They capture the raw wireless Thread packets via a physical USB dongle and securely bridge them onto the standard Wi-Fi/Ethernet network.

### 3. `platform/` (The Central Server)
*   **Gateway**: A resilient Python service that ingests the UDP CoAP telemetry, parses the payload, and forwards it to the REST API.
*   **Spring Boot API**: Java 21 backend that manages sensor registration, time-series data storage, and alert thresholds.
*   **MongoDB**: NoSQL database optimized for high-frequency time-series telemetry.
*   **ML Analytics**: Python FastAPI service running isolation-forest anomaly detection on environmental baselines.
*   **React Dashboard**: A beautiful, real-time frontend for visualizing the mesh network health and live telemetry.

## 🚀 Quick Start

To launch the entire backend server stack locally:

```bash
# 1. Start the Platform, Database, ML Service, and Dashboard
make start-platform

# 2. View the live telemetry logs
make logs
```

To run the full stack *plus* the Mac Border Router:
```bash
make start
```

## 🛠️ Repository Organization

```text
ssns-openthread-iot/
├── platform/                 ← Spring Boot API, Dashboard, ML, Gateway, DB (includes docker-compose)
├── edge-nodes/               ← Mac & Windows Docker OTBR configurations
├── firmware/                 ← Zephyr C codebase & Hex files
├── scripts/                  ← Hardware flashing utilities
├── docs/                     ← Comprehensive guides and diagrams
└── Makefile                  ← Orchestration shortcuts
```
