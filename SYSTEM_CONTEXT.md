# SSNS Project: System Context & Hardware Mapping

> [!IMPORTANT]
> **To any AI Assistant:** Read this document immediately when helping with this project. It defines the exact hardware mappings, networking bridges, and software architecture to prevent breaking changes or forgetting context.

## 1. Hardware Roles & Firmware Mapping
The system uses physical Nordic hardware running Zephyr RTOS / OpenThread.

| Role | Hardware Required | Firmware Source Path | Build Target |
| :--- | :--- | :--- | :--- |
| **Sensor Node** | nRF52840 DK | `nrf-firmware/sensor-node` (Custom) | `nrf52840dk/nrf52840` |
| **Border Router** | nRF52840 DK | Nordic SDK `nrf/samples/openthread/coprocessor` | `nrf52840dk/nrf52840` |
| **Border Router** | nRF52840 Dongle | Nordic SDK `nrf/samples/openthread/coprocessor` | `nrf52840dongle/nrf52840` |

* **Sensor Nodes:** Transmit environmental data via CoAP over UDP over IPv6 via the Thread mesh.
* **Border Router:** Runs RCP (Radio Co-Processor) firmware. Connected to the Mac via USB. Translates 802.15.4 radio frames to the Mac over the Spinel protocol.

## 2. Distributed Fog Architecture (High Availability)
The system is designed for **Active-Active High Availability**. Multiple "Fog Nodes" can run simultaneously on different machines to provide redundant entry points for the sensor mesh.

### A. Mac/Linux Fog Node (`edge-nodes/mac-fog-node`)
*   **Bridge Type:** TCP-to-Serial bridge (`host.docker.internal:2000`).
*   **Networking:** Uses a Docker bridge network (`ssns-fog-network`).
*   **CoAP Proxy:** `socat UDP6-LISTEN:5683,fork UDP4:gateway:5683`.

### B. Windows Fog Node (`edge-nodes/windows-fog-node`)
*   **Platform:** Native Docker on WSL2 (No Docker Desktop).
*   **Bridge Type:** Direct Hardware Passthrough via `usbipd` and `/dev/dev` mapping.
*   **Networking:** Uses `network_mode: host` for native performance.
*   **CoAP Proxy:** `socat UDP6-LISTEN:5683,bind=[fd5e:a726:ec55:ee12::1] UDP4:127.0.0.1:5683`.
*   **Supervisor:** A custom bash loop that manages radio hotplugging and auto-restarts the OTBR agent.

### C. Sensor Failover Logic
Sensor nodes utilize **OpenThread ALOC (Anycast Locator)** routing. They transmit to the Anycast address `fd5e:a726:ec55:ee12::1`. If one Fog Node goes offline, the Thread mesh automatically routes the packet to the next available Fog Node (Border Router) that is advertising that prefix.

## 3. The Platform Core
The "Core" stack resides in `platform/` and handles centralized data persistence and analytics. Fog nodes forward data to the Core via Tailscale or local network IPs.

## 4. Key Configurations
* **Timeouts:** The Backend expects a telemetry heartbeat every 10 seconds. It will flag a node as `OFFLINE` if no packet is received within 120 seconds (configurable in backend `application.yml`).
* **Node IDs:** Node IDs (e.g., `node-598c`) are physically derived from the factory-burned EUI-64 MAC address in the nRF52840 silicon. They are completely permanent and unique per physical board.

## 5. Thread Network Formation & Credentials

> [!TIP]  
> **Fully Automated Network Formation:** The `docker-compose.yml` file is configured with an automated initialization script. If you wipe a board (e.g., using `--chiperase`) or plug in a brand new dongle, you do **not** need to use the Web GUI. 

Every time you run `docker compose up -d`, the container waits 10 seconds and automatically provisions the physical board with the exact `WSN01` credentials, PAN ID, and Mesh Local Prefix required by the Sensor Nodes. 

It is entirely hardware-agnostic and plug-and-play.
