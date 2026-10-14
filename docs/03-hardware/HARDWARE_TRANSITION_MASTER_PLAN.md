# SSNS: Hardware Transition Master Plan (Simulation to Physical)

This document serves as the authoritative technical blueprint for transitioning the SSNS project from a "Pure Simulation" to a "High-Integrity Physical Sensor Network." It covers hardware mapping, timing strategies, and cross-stack data protection logic.

---

## 1. Hardware Definition (I2C Bus)
The system will utilize a single **nRF52840 DK** as a multi-sensor node. All physical sensors will share the same I2C bus (P0.26 SDA, P0.27 SCL).

| Sensor Model | Measurement | I2C Address | Physical Constraint |
| :--- | :--- | :--- | :--- |
| **Sensirion SCD41** | CO2 / Humidity | `0x62` | 5s-10s measurement time; optical pulse. |
| **Microchip MCP9808** | Temperature | `0x18` | ±0.25°C precision; fast conversion. |
| **Sensirion SPS30** | PM 2.5 / PM 10 | `0x69` | Requires 5V; internal fan needs stabilization. |
| **Adafruit CCS811** | TVOC | `0x5A` | Requires constant heating; long warm-up. |

---

## 2. The "Decompressed Loop" Timing Strategy
To ensure the **OpenThread Radio Stack** remains stable while the CPU is busy waiting for slow sensors, we transition from a 10-second loop to a **30-second High-Integrity Cycle**.

### Proposed 30-Second Cycle Breakdown:
1.  **Acquisition Phase (0s - 12s):**
    *   SCD41: 10.0s (Safe margin).
    *   SPS30: 1.0s.
    *   CCS811: 1.0s.
    *   MCP9808: 0.1s.
    *   *Total Wait Time:* **~12.1 Seconds.**
2.  **Transmission Phase (12s - 13s):**
    *   CBOR Encoding and CoAP `PUT` request to Gateway.
3.  **Maintenance Window (13s - 30s):**
    *   **20 Seconds of CPU Idle.** 
    *   *Critical:* This window allows the nRF52840 to handle OpenThread "Keep-Alives," Mesh maintenance, and incoming CoAP ACKs without interruption.

---

## 3. High-Integrity Error Handling (Cross-Stack)
To prevent physical hardware failures from poisoning the database or ML models, the system implements **Graceful Degradation**.

### Tier 1: Firmware "Fault Flags"
*   If `device_is_ready()` fails or communication times out, the firmware must **not hang**.
*   **Semantic Placeholder:** Use `-999.0f` for any faulty sensor reading.
*   **Health Bitmask:** Add a 1-byte `health_mask` to the telemetry payload.
    *   `0x01`: Temp OK | `0x02`: CO2 OK | `0x04`: PM OK | `0x08`: VOC OK.

### Tier 2: ML Service "Sanity Filter"
*   **Logic:** The ML Poller must check the feature vector before inference.
*   **Action:** If any value is `<= -900.0`, the ML service **skips** that reading. This prevents the Isolation Forest from learning from "garbage" data and triggering false anomaly alerts.

---

## 4. Intelligent Warm-up (The "Silent Start")
*   **Logic:** Chemical sensors (SCD41/CCS811) are unstable for the first minute of power.
*   **Implementation:** The node will remain completely silent (no CoAP transmission) for the first **60 seconds** of uptime.
*   **Benefit:** Ensures the Central Database and ML models only receive stabilized, atomic data sets.

---

## 5. Data Representation (Example Failure Payload)

To visualize how a hardware fault propagates through the system, consider a scenario where the **CO2 sensor (SCD41)** is disconnected.

### A. CBOR Array (Air-Interface)
The nRF52840 encodes a binary array to save power. Note the `-999.0` at the CO2 index.
```text
[
  "node-598c",  // NodeID
  "08x_boot",   // BootID
  42,           // Seq Num
  120000,       // Uptime (ms)
  22.5,         // Temp
  45.0,         // Humidity
  -999.0,       // CO2 (FAULT FLAG)
  150.0,        // TVOC
  ...
  0xFD          // Health Mask (1111 1101) - Bit 1 (CO2) is 0
]
```

### B. JSON Object (Cloud-Interface)
The Gateway translates the CBOR into this JSON for the Spring Boot API:
```json
{
  "nodeId": "node-598c",
  "temperature": 22.5,
  "co2": -999.0,
  "healthStatus": 253,
  "timestamp": "2026-06-01T20:00:00Z"
}
```

### C. ML Service "Sanity" Logic
```python
# The ML Poller skips the reading before it hits the model
if any(v <= -900.0 for v in latest_reading.values()):
    logger.warning("Hardware fault detected; skipping ML inference.")
```

---

## 6. Deployment Configuration Changes

### A. Backend API (`application.yml`)
*   **Change:** Increase `node-timeout` (or `last-seen-threshold`) to **120 seconds**.
*   **Reason:** Prevents the backend from marking nodes as `OFFLINE` during the longer 30-second cycles.

### B. ML Service (`.env`)
*   **Change:** Reduce `BASELINE_WINDOW_SIZE` to **10 or 15**.
*   **Reason:** At 30-second intervals, a 20-reading window takes 10 minutes to calibrate. Reducing it allows for faster anomaly detection startup.

---

## 7. Implementation Roadmap (For Implementation Agent)

### Phase 0: Chaos Simulation (Pre-Hardware Test)
*   **Objective:** Verify that the system handles "poisoned" data correctly before real sensors are attached.
*   **Task:** Update `sensors.c` simulation logic to include a randomized 2% chance of "Hardware Failure."
*   **Action:** If a failure is triggered, the simulation must set the value to `-999.0` and flip the corresponding bit in the `health_mask`.
*   **Validation:** Confirm that the ML Service correctly "skips" these readings without triggering a false ML alert.

### Phase 1: Simulated Reality (Timing & Intervals)
*   **Objective:** Match the firmware's timing to physical hardware constraints.
*   **Task:** Update `main.c` to 30-second intervals and inject `k_msleep()` delays.

### Phase 2: Infrastructure Sync
*   Update Backend and ML timeouts to match the 30-second cycle.

---

## 8. Physical Latency & Timing Summary

In the real world, "reading a sensor" is not an instantaneous CPU operation. To ensure **High Integrity** and prevent radio stack starvation, we use the following timing parameters:

| Phase | Simulation (Now) | Real World (Recommended) |
| :--- | :--- | :--- |
| **Telemetry Interval** | 30 Seconds | **30 Seconds** (Balance battery vs. data) |
| **Sampling Latency** | 12.1 Seconds | **~12.5 Seconds** |
| **CoAP ACK Timeout** | **3000 ms** | **3000 ms** (Failover Safety Margin) |
| **NVS Drain Delay** | 500 ms | **1000 ms** (Mesh Stability) |

---

## 9. Implementation Checklist (Hardware Phase)

### Stage 1: Physical & I2C Layer
* [ ] **Bus Voltage:** Verify VCC (3.3V) and GND are stable across all sensors.
* [ ] **I2C Connectivity:** Run `i2c scan` from the Zephyr shell (if enabled) to verify all 4 addresses (`0x62`, `0x18`, `0x69`, `0x5A`) are visible.
* [ ] **MCP9808 Precision:** Check that the temperature reading is within ±0.5°C of a known thermometer.

### Stage 2: Firmware & Mesh
* [ ] **Silent Start:** Verify that the node stays quiet (no radio logs) for the first 60 seconds after power-on.
* [ ] **Timing Validation:** Confirm that the total 30-second loop remains stable and the node does not drop from the Thread mesh during the 10-second blocking phase.
* [ ] **Fault Handling:** Physically unplug one sensor and verify that the node continues to transmit (Graceful Degradation).
* [ ] **CBOR Encoding:** Check that the packet size remains compact (typically < 100 bytes) even with real data.
