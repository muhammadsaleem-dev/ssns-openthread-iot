# Edge Layer Architecture & Firmware Implementation

This document explains the embedded firmware design, real-time mathematical calculations, hardware error handling, and network self-healing features implemented on the **Edge Sensor Nodes**. It is written in simple, clear language so any team member can easily understand and explain our code.

---

## 1. Overview & Goal
Rather than acting as simple transmitters that blindly send raw numbers over the network, our hardware nodes act as **Smart Data Pre-Processors**. 

Written in C and powered by the chip's built-in **ARM Hardware Floating-Point Unit (FPU)**, the firmware continuously samples environmental sensors, smooths out noisy data locally, follows manufacturer calibration rules, and automatically recovers from hardware disconnections and network drops.

---

## 2. Embedded Statistical Pre-Processing Pipeline

### A. Time-Series Summarization via 3-Minute Rolling Window
Rather than acting as a dumb pass-through transmitter, the microcontroller pre-computes time-series summary statistics locally. Physical sensors naturally produce minor random variations from second to second. To convert this physical noise into structured analytical trends, the firmware maintains a continuous circular rolling memory buffer of **30 samples** (representing a strict 3-minute observational window at a 6-second polling rate).

### B. The Two-Pass Algorithm (Preventing Rounding Errors)
Calculating a standard deviation on small microcontrollers can lead to severe rounding errors if calculated naively. Our firmware solves this by using a stable **Two-Pass Algorithm**:
1. **Pass 1:** Calculates the exact rolling **Mean (Average)** across the 30-sample circular buffer.
2. **Pass 2:** Calculates the variance from that average to find the rolling **Standard Deviation**, while also tracking the absolute **Maximum reading**.

These three condensed summary numbers (Mean, Standard Deviation, Max) are packaged into a compact CBOR binary message and sent to the backend, providing the exact statistical context needed to detect anomalies.

### C. Multi-Threaded Polling & Strict Transmission Cadence

To build a reliable system, we had to carefully balance the **hardware limits from the manufacturer datasheets** against **our own software design choices**:

1. **Hardware Measurement Limits (Datasheet Constraints):**
   Every physical sensor chip requires a fixed amount of time to complete an internal chemical or optical measurement:
   * **SCD41 (CO2):** Requires **5.5 seconds** per measurement cycle.
   * **CCS811 (TVOC):** Requires **1.5 seconds** per measurement cycle.
   * **SPS30 (Particulates):** Requires **1.0 second** per measurement cycle.
   If polled sequentially in a basic loop, fast sensors would be blocked waiting for slow sensors, creating severe **Temporal Sampling Skew**.

2. **Our Architectural Cadence (Design Choice):**
   To overcome these hardware limits, we implemented **Asynchronous Background Threads** combined with a strict timing cadence:
   * **Independent Polling:** Each sensor runs on its own dedicated background thread, updating a thread-safe memory cache at its exact datasheet speed.
   * **Our Sampling Rate (6s Choice):** We specifically designed our main aggregator thread to sample the cache every **6 seconds**. We chose 6 seconds because it provides a safe margin above the slowest sensor's datasheet limit (5.5s), guaranteeing that every sensor has delivered at least one fresh reading before we sample.
   * **Our Transmission Rate (30s Choice):** We chose to package and transmit data over the wireless Thread radio every **30 seconds** (exactly 5 buffered samples). This batches radio transmissions to conserve battery while keeping network latency low.

---

## 3. Hardware Best Practices & Built-in Calibration

To handle natural sensor drift over time without needing someone to manually recalibrate them in the field, our firmware relies on manufacturer best practices:

* **SCD41 (CO2):** Uses **Automatic Self-Calibration (ASC)**. The sensor remembers the lowest CO2 reading it sees over a 7-day period—assuming that represents fresh outdoor air at 400 ppm—and automatically adjusts its internal baseline offset.
* **CCS811 (TVOC):** Enforces **Warm-Up Suppression & Error Filtering**. Gas sensors produce wildly unstable numbers right after being powered on. Following manufacturer guidelines, our C code (`ccs811_driver.c`) automatically blocks sensor output for the first 20 minutes after booting. It also actively filters out internal hardware error codes (like `0xFDFD`) so bad data never reaches the database.
* **SPS30 (Particulates):** Uses an **Automatic Weekly Fan Cleaning**. Every 168 hours (once a week), the internal fan automatically spins at maximum speed for exactly 10 seconds to blow away accumulated dust that could block the optical laser.

---

## 4. Hardware Fault Handling (The Health Vector)

If a physical sensor wire unplugs or loses power, basic embedded loops will freeze forever waiting for a response, crashing the entire device.

Our firmware prevents this using a **Strict Timeout & Health Vector Bitmask**:
* Every sensor is assigned a specific status bit inside a `health_vector` byte.
* If a sensor stops responding, the firmware catches the timeout, **clears that specific sensor's health bit**, and inserts safe fallback numbers into the buffer.
* When the central backend receives the packet, it reads this health vector, ignores the broken sensor's data, and sends a maintenance warning to the dashboard—all while keeping the node's other healthy sensors running smoothly.

---

## 5. Network Self-Healing & RAM Buffering

Wireless mesh networks (**OpenThread IPv6**) occasionally experience brief connection drops when routing paths change.

1. **ACK Tracking:** Every time the node sends a data batch, it waits up to 5 seconds for a confirmation (ACK) from the parent router.
2. **Emergency RAM Buffer:** If the confirmation fails to arrive, the message is saved into a local **50-slot RAM Circular Buffer** (preserving up to 25 minutes of historical data) and tries to send again on the next cycle.
3. **Automatic Radio Reset:** If **3 consecutive send attempts fail** (15 seconds of waiting), the firmware assumes its radio connection is stuck. It automatically reboots the OpenThread networking stack, forcing the radio to scan the area and re-attach to another available Fog node (Gateway Host) in our distributed topology.

---

## 6. Team Q&A & Open Inquiries (Faris)

*This section is reserved for Faris's inquiries. Faris, if you have any questions regarding the C code implementation or require specific technical justifications for your report section, please drop your questions below, and the lead developer will document the exact answers right here.*

- **Q (Faris):** *(Type your question here)*
  > **A:** *(Pending response)*
