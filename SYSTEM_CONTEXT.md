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

## 2. macOS Networking Workarounds
Because Docker Desktop on macOS lacks native USB pass-through and has poor native IPv6 support, the following bridges are in place:

### A. The Serial Bridge (`start_otbr_bridge.sh`)
* **What it does:** Uses `socat` on the macOS host to forward the Border Router's USB serial connection (`/dev/cu.usbmodem*`) to `TCP-LISTEN:2000`.
* **Auto-detection:** The script automatically scans `/dev/cu.usbmodem*` to find the plugged-in DK or Dongle. **It does not need to be manually edited.**
* **Docker OTBR:** The `ssns-otbr` container connects to `host.docker.internal:2000` to talk to the radio.

### B. The IPv6 to IPv4 Proxy (Inside OTBR)
* **What it does:** A background `socat` process runs inside the `ssns-otbr` container.
* **Why:** The CoAP packets arriving from the mesh network are native IPv6 UDP. Docker Mac cannot easily route this to the Gateway container.
* **How:** `socat UDP6-LISTEN:5683,fork UDP4:gateway:5683`. It catches the Thread packets and forwards them to the Python Gateway over standard IPv4.

## 3. The Docker Stack
All services are orchestrated via the root `docker-compose.yml`:
1. `otbr` (ssns-otbr): The OpenThread Border Router (contains the `socat` proxy).
2. `gateway` (ssns-monitoring-gateway): Python `aiocoap` server. Receives JSON payload, forwards to backend.
3. `platform/api`: Spring Boot REST API. Manages devices, alerts, timeouts.
4. `platform/dashboard`: React/Vite UI.
5. `platform/ml-service`: Python ML anomaly detection.
6. `platform/gateway`: Python CoAP proxy.
6. `mongodb` (ssns-monitoring-mongo): Primary datastore.

## 4. Key Configurations
* **Timeouts:** The Backend expects a telemetry heartbeat every 10 seconds. It will flag a node as `OFFLINE` if no packet is received within 120 seconds (configurable in backend `application.yml`).
* **Node IDs:** Node IDs (e.g., `node-598c`) are physically derived from the factory-burned EUI-64 MAC address in the nRF52840 silicon. They are completely permanent and unique per physical board.

## 5. Thread Network Formation & Credentials

> [!TIP]  
> **Fully Automated Network Formation:** The `docker-compose.yml` file is configured with an automated initialization script. If you wipe a board (e.g., using `--chiperase`) or plug in a brand new dongle, you do **not** need to use the Web GUI. 

Every time you run `docker compose up -d`, the container waits 10 seconds and automatically provisions the physical board with the exact `WSN01` credentials, PAN ID, and Mesh Local Prefix required by the Sensor Nodes. 

It is entirely hardware-agnostic and plug-and-play.
