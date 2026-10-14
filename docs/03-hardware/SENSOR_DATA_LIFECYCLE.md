# SSNS: The Comprehensive Technical Journey of Sensor Data

This document provides an exhaustive, low-level technical analysis of the data lifecycle within the Smart Sensor Network System (SSNS). It traces a single bit of telemetry from the physical hardware register to its final resting place in the cloud database and its analysis by machine learning models.

---

## 1. Phase 1: The Edge Layer (Firmware & Silicon)

### A. System Initialization & Warm-up
The sensor node (nRF52840) boots Zephyr RTOS. Before transmitting data, it undergoes a **60-second "Silent Start" warm-up phase**. This allows the electrochemical sensors (like the SCD41 CO2 sensor) to stabilize their internal heaters and the OpenThread stack to perform a "Parent Search" to find the most stable Border Router.

### B. High-Integrity Data Acquisition
The firmware (written in C) executes a precise measurement cycle every 30 seconds:
1.  **Hardware Sampling:** Data is pulled via I2C from a suite of sensors including temperature, humidity, CO2 (SCD41), particulate matter (SEN5x), and light intensity.
2.  **Health Vector Generation:** If a sensor fails to respond (NACK on I2C), the system doesn't just send a zero; it updates a **16-bit Health Mask**. This mask tells the cloud exactly *which* component failed (e.g., bit 3 for CO2 failure).

### C. The CBOR Binary Payload (Payload Engineering)
To minimize radio "on-time" and save battery, SSNS avoids JSON. It uses **CBOR (Concise Binary Object Representation)** encoded as a fixed-position array. The 15-item array structure is:
*   `[0]` Node ID (String, e.g., "node-598c")
*   `[1]` Boot ID (8-char Hex, randomized at power-on)
*   `[2]` Sequence Number (uint32, incrementing)
*   `[3]` Uptime (uint32, milliseconds since boot)
*   `[4-13]` Environmental floats (T, H, CO2, TVOC, eCO2, PM1.0, PM2.5, PM4.0, PM10, Light)
*   `[14]` Health Mask (uint32 bitmask)

### D. The Store-and-Forward Failover (NVS)
If the Thread network is down, the node enters **Offline Mode**:
1.  **NVS Caching:** The binary CBOR payload is written to Flash memory via Zephyr's **Non-Volatile Storage (NVS)** system.
2.  **Sector Rotation:** The system uses a circular buffer in flash to prevent wear on the silicon.
3.  **The ACK Loop:** The node continues attempting to send a "Live" packet. Only when it receives a **CoAP ACK (Type 2)** from a Fog Node does it begin "draining" the NVS backlog, sending 5 historical packets for every 1 live packet until the queue is empty.

---

## 2. Phase 2: The Radio Layer (802.15.4 & Thread)

### A. Anycast Transmission
The sensor sends a **CoAP PUT** request to the Anycast IPv6 address `fd5e:a726:ec55:ee12::1`. This is a "Shared Identity" held by all Border Routers in the mesh. The 802.15.4 radio frames are encrypted using AES-128 CCM.

### B. RCP to OTBR Communication
The Border Router hardware (nRF52840 Dongle) runs **RCP (Radio Co-Processor)** firmware. It communicates with the host machine (Mac/Windows) using the **Spinel Protocol** over a high-speed UART/USB link. The host runs the `otbr-agent`, which translates these Spinel frames into standard Linux networking packets on the `wpan0` interface.

---

## 3. Phase 3: The Fog Tier (The Self-Healing Supervisor)

### A. The Hardware Bridge
On Windows WSL2, the `ssns-otbr` container runs a **Supervisor Loop**. It constantly monitors `/dev/ttyACM0`. If the dongle is unplugged, the loop waits; the moment it is replugged (via `usbipd`), the supervisor:
1.  Resets the `wpan0` interface.
2.  Re-injects the **WSN01 Thread Dataset** (PAN ID, Network Key).
3.  Starts a `socat` bridge to solve the "IPv6-to-IPv4" routing gap found in virtualized Docker environments.

### B. IPv6 Proxying
The `socat` bridge listens on the specific Thread Mesh Local Prefix (`fd5e:a726:ec55:ee12::1`) and forwards the raw UDP data to the Python Gateway at `127.0.0.1:5683`. This ensures the application layer remains platform-agnostic.

---

## 4. Phase 4: The Gateway Layer (Intelligence at the Edge)

### A. Distributed Deduplication (Redis SETNX)
In an Active-Active setup, two Fog Nodes might hear the same sensor burst. To prevent double-counting, the Gateway uses a **Distributed Lock**:
1.  It generates a key: `dedup:<NodeID>:<BootID>:<SeqNum>`.
2.  It attempts an atomic `SETNX` (Set if Not Exists) in Redis with a 5-minute TTL.
3.  If `SETNX` returns 0, the packet is silently dropped as a duplicate.

### B. The Time Reconstruction Algorithm
This is the most critical logic for data integrity. When an NVS backlog packet arrives, its arrival time is meaningless. The Gateway reconstructs the past:
1.  **Reference Point:** Redis stores the `latest_known_uptime` for that specific Node ID.
2.  **The Delta:** `Offset = latest_known_uptime - packet_uptime_from_cbor`.
3.  **The Reconstruction:** `Original_Timestamp = Now() - Offset`.
This ensures that data sampled at 2:00 AM but delivered at 4:00 AM is correctly graphed at 2:00 AM.

---

## 5. Phase 5: The Core Layer (Persistence & Analytics)

### A. The Resilient Queue (Redis List)
The reconstructed packet is pushed to `telemetry:queue`. A background worker polls this list. If the central Spring Boot API is unreachable, the worker moves the packet to a **Redis Sorted Set** (`telemetry:retry`) where it is scheduled for retry using **Exponential Backoff** (2^retry_count seconds).

### B. Spring Boot Ingestion
The packet reaches the API via Nginx. The API performs:
1.  **Validation:** Checks the Health Mask.
2.  **Persistence:** Saves the record to **MongoDB**.
3.  **Alerting:** If values exceed safety thresholds, a notification is generated.

### C. ML Service & Anomaly Detection
The data is forwarded to a Python FastAPI service running **Isolation Forest** models:
1.  **The Sanity Filter:** If the Health Mask indicates a sensor failure (or if the value is the "error constant" -999.0), the ML service **suppresses inference**. This prevents hardware faults from "poisoning" the training data.
2.  **Forecasting:** The model analyzes the last 60 minutes of CO2 data to predict the next 5 minutes, allowing for proactive ventilation alerts.

---
**Technical Summary:** This architecture ensures that data is protected by hardware-level persistence (NVS), network-level redundancy (Anycast), and application-level integrity (Time Reconstruction & ML Filtering).
