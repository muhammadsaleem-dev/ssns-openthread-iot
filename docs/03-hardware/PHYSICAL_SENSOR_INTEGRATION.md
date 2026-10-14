# SSNS: Physical Sensor Integration Guide

This document provides a complete technical roadmap for transitioning the **nRF52840 Sensor Node** from telemetry simulation to real-world physical sensing using the sensors specified in the project proposal.

---

## 1. Physical Hardware Mapping

The system utilizes an **I2C Shared Bus** architecture. All sensors will connect to the same four wires on the nRF52840 DK.

| Measurement | Model | I2C Address | Connection Logic |
| :--- | :--- | :--- | :--- |
| **CO2 / Humidity** | Sensirion SCD41 | `0x62` | NDIR Optical Sensing |
| **Temperature** | Microchip MCP9808 | `0x18` | High-Precision Digital |
| **PM 2.5 / PM 10** | Sensirion SPS30 | `0x69` | Laser Scattering (needs 5V) |
| **TVOC** | Adafruit CCS811 | `0x5A` | Metal Oxide Sensing |

### Wiring (nRF52840 DK Arduino Headers)
*   **VCC (3.3V):** Connect to all sensors (Note: SPS30 may require the **5V** pin for its fan).
*   **GND:** Connect to all sensors.
*   **SDA (P0.26):** Connect to all sensor SDA pins.
*   **SCL (P0.27):** Connect to all sensor SCL pins.

---

## 2. Phase 1: DeviceTree Configuration
Update your `firmware/sensor-node/boards/nrf52840dk_nrf52840.overlay` to register the hardware.

```dts
&i2c0 {
	status = "okay";
	pinctrl-0 = <&i2c0_default>;
	pinctrl-1 = <&i2c0_sleep>;
	pinctrl-names = "default", "sleep";

	/* Sensirion SCD41 (CO2/Humidity) */
	scd41: scd4x@62 {
		compatible = "sensirion,scd4x";
		reg = <0x62>;
	};

	/* Microchip MCP9808 (Temperature) */
	mcp9808: mcp9808@18 {
		compatible = "microchip,mcp9808";
		reg = <0x18>;
	};

	/* Sensirion SPS30 (Particulate Matter) */
	sps30: sps30@69 {
		compatible = "sensirion,sps30";
		reg = <0x69>;
	};

	/* CCS811 (VOC) */
	ccs811: ccs811@5a {
		compatible = "ams,ccs811";
		reg = <0x5a>;
	};
};
```

---

## 3. Phase 2: Project Configuration
Add these lines to `firmware/sensor-node/prj.conf` to enable the drivers in the Zephyr kernel.

```bash
# Enable I2C and Sensor Subsystem
CONFIG_I2C=y
CONFIG_SENSOR=y

# Enable Specific Drivers
CONFIG_SCD4X=y
CONFIG_MCP9808=y
CONFIG_SPS30=y
CONFIG_CCS811=y

# Custom Toggle for Hybrid Mode
CONFIG_SENSOR_HARDWARE_ENABLE=y
```

---

## 4. Phase 3: Hybrid Firmware Logic
In `firmware/sensor-node/src/sensors.c`, implement a toggle to keep the simulation alive as a fallback.

### Updated `sensor_service_read` structure:
```c
void sensor_service_read(struct sensor_state *s, ...) {
#ifdef CONFIG_SENSOR_HARDWARE_ENABLE
    /* 1. Fetch from Real Drivers */
    const struct device *dev_temp = DEVICE_DT_GET(DT_NODELABEL(mcp9808));
    struct sensor_value val;

    if (device_is_ready(dev_temp)) {
        sensor_sample_fetch(dev_temp);
        sensor_channel_get(dev_temp, SENSOR_CHAN_AMBIENT_TEMP, &val);
        *temp = (float)sensor_value_to_double(&val);
    } else {
        /* Fallback to simulation if hardware fails */
        *temp = s->base_temp; 
    }
    
    // ... Repeat for CO2, PM, and TVOC drivers ...

#else
    /* 2. Existing Simulation Logic (Keep this code!) */
    *temp = s->base_temp + rand_float(-0.05f, 0.05f);
    // ... (rest of current random logic) ...
#endif
}
```

---

## 5. Implementation Strategy (The "Safe" Way)

1.  **Iterative Integration:** Connect and code **one sensor at a time**. Do not try to wire all four at once.
2.  **Verify via Shell:** Use `ot-ctl` or Zephyr Shell commands to scan the I2C bus to ensure the DK sees the sensors before compiling.
3.  **High Integrity Health Checks:** In the final code, if `device_is_ready()` returns false, send a specific "Error Flag" in your CBOR payload so the Dashboard can alert the user that a physical cable is loose.
4.  **Warm-up Management:** Add a `k_sleep(K_MINUTES(2))` in `sensor_service_init` when in hardware mode to allow the chemical sensors to stabilize.

---

## 6. High Integrity Error Handling (Cross-Stack Propagation)

To prevent a single physical sensor failure from "poisoning" your database or triggering false ML alarms, the system must implement **Graceful Degradation**.

### Tier 1: The Firmware (The Source of Truth)
If `device_is_ready()` fails or I2C communication times out, the firmware must not hang. It should send a **Semantic Placeholder**.

*   **Logic:** Use `-999.0` as a "Hardware Fault" flag.
*   **Why:** This is physically impossible for temperature or CO2 in an office, making it easy to filter later.

```c
// Example: Resilient Fetch logic in sensors.c
if (device_is_ready(dev_co2)) {
    sensor_sample_fetch(dev_co2);
    // ... get real value ...
} else {
    *co2 = -999.0f; // Set hardware fault flag
}
```

### Tier 2: The Backend API (The Gatekeeper)
The Spring Boot API should be updated to recognize these flags. Instead of treating `-999.0` as a valid number, it should log a **"Sensor Degraded"** event.

*   **Improvement:** Add a `healthStatus` map to the `SensorData` model to track which physical sensors are currently failing.

### Tier 3: The ML Service (Model Protection)
**CRITICAL:** The ML service (Isolation Forest) is sensitive to extreme values. If it "sees" `-999.0`, it will mark it as a massive anomaly or ruin its baseline calculations.

*   **Sanity Filter:** Update `poller.py` to skip any feature vector containing a `-999.0` value.
```python
# Conceptual filter for ML Poller
if any(val <= -900.0 for val in features):
    logger.warning(f"Skipping ML inference for node {node_id} due to hardware fault flag.")
    continue 
```

### Tier 4: The Dashboard (User Awareness)
The React UI should not show "-999" on the graph. 
*   **Visual Feedback:** If the value is `-999.0`, the frontend should render a **RED WARNING ICON** (⚠️) next to that specific sensor metric.

---

## 7. Intelligent "Warm-up" Management (The "Silent Start")
Chemical sensors (SCD41 and CCS811) produce unstable "garbage data" for the first few minutes after power-on. To maintain 100% data integrity, the system uses a **Total Silent Start** approach.

*   **Implementation:** In the main application loop, use a 60-second delay before the first CoAP transmission.
*   **Behavior:** The node will join the Thread mesh immediately but will **withhold all telemetry** until the 60-second mark.
*   **Benefit:** Ensures that every single record stored in MongoDB is "Stabilized and Atomic." The ML service only begins its baseline calculation with high-quality, reliable data.

---

## 9. Physical Latency & Timing

In the real world, "reading a sensor" is not an instantaneous CPU operation. To ensure **High Integrity** and prevent radio stack starvation, we use a conservative 10-second safety margin for the slowest sensors.

| Sensor Model | Physical Measurement Time | Safety Margin | Impact |
| :--- | :--- | :--- | :--- |
| **MCP9808** | ~100 ms | 500 ms | Fast digital conversion. |
| **SCD41** | **~5,000 ms (5 seconds)** | **10,000 ms (10 seconds)** | **Critical Path:** Highest latency. |
| **SPS30** | ~1,000 ms | 2,000 ms | Needs fan stabilization. |
| **CCS811** | ~1,000 ms | 2,000 ms | Needs heater stabilization. |

### Architectural Strategy: The "Decompressed Loop"
Because the **SCD41** requires 10 seconds (with safety margin) to provide a reliable reading, a standard 10-second transmission interval is too aggressive. It would leave zero time for the nRF52840 to maintain its OpenThread mesh connection.

**M.Sc. Recommendation:**
1.  **Telemetry Interval:** Increase to **30 Seconds**.
2.  **Cycle Breakdown:**
    *   **0s - 10s:** Sensor Acquisition (Blocked/Waiting for I2C).
    *   **10s - 10.5s:** Packet Creation & CoAP Transmission.
    *   **10.5s - 30s:** **Idle / Maintenance Window.** This 20-second gap is critical. It allows the OpenThread stack to process background maintenance packets, ACKs, and routing updates, ensuring the node stays `ONLINE` consistently.

---

## 10. Verification Checklist (Hardware Phase)

### Stage 1: Physical & I2C Layer
* [ ] **Bus Voltage:** Verify VCC (3.3V) and GND are stable across all sensors.
* [ ] **I2C Connectivity:** Run `i2c scan` from the Zephyr shell (if enabled) to verify all 4 addresses (`0x62`, `0x18`, `0x69`, `0x5A`) are visible.
* [ ] **MCP9808 Precision:** Check that the temperature reading is within ±0.5°C of a known thermometer.

### Stage 2: Firmware & Mesh
* [ ] **Silent Start:** Verify that the node stays quiet (no radio logs) for the first 60 seconds after power-on.
* [ ] **Timing Validation:** Confirm that the total 30-second loop remains stable and the node does not drop from the Thread mesh during the 10-second blocking phase.
* [ ] **Fault Handling:** Physically unplug one sensor and verify that the node continues to transmit (Graceful Degradation).
* [ ] **CBOR Encoding:** Check that the packet size remains compact (typically < 100 bytes) even with real data.

### Stage 3: Cloud & Analytics
* [ ] **Ingestion Flow:** Confirm real sensor values appear in the React Dashboard in real-time.
* [ ] **Data Range:** Ensure CO2 and VOC levels stabilize to realistic indoor values (e.g. 400-800ppm for CO2) after the warm-up.
* [ ] **ML Integrity:** Trigger a manual anomaly (e.g., breathe on the sensor) and verify that the ML Service detects the "Multi-Variable Spike."
* [ ] **False Alarm Check:** Ensure that a physical sensor disconnection DOES NOT trigger an ML Anomaly Alert (the Sanity Filter is working).
