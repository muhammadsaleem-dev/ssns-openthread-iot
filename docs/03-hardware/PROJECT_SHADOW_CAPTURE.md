# Project Shadow Capture: High-Integrity No-Dongle Thread Detection
## 1. Vision Statement
To achieve what is widely considered "impossible" in commercial IoT: capturing and decoding Thread (802.15.4) telemetry on an unmodified smartphone without external hardware.

## 2. The Problem: The "Hardware Isolation Gap"
In modern smart buildings, there is a massive wall between **Infrastructure** (Thread/Zigbee) and **Users** (Smartphones). 
*   **Blind Monitoring:** Smartphones physically cannot see 802.15.4 traffic. A technician is "blind" without expensive dongles and laptop-based sniffers.
*   **Dependency:** If a Gateway fails, there is often no way to verify if the physical sensors are still alive without dismantling hardware.

## 3. The Solution: "Technician's Energy Seismograph"
This project implements a **High-Integrity Side-Channel**. By using the laws of radio physics, we turn a standard smartphone into a "Universal Seismograph" that can feel the presence and data of an IoT network through its internal Wi-Fi chip.

## 4. Technical Principle: Cross-Technology Intermodulation (CTI)
... (rest of the content remains) ...

## 9. Key Benefits for Field Operations
1.  **Zero-Hardware Diagnostics:** A technician can walk into a room and instantly verify node health using only a personal phone.
2.  **Emergency Fail-Safe:** If the main Mac/Windows Fog Nodes are offline, data can still be read directly from the air via the "Shadow" pulses.
3.  **Low-Cost Deployment:** Scale to hundreds of rooms without requiring hundreds of diagnostic sniffers.

Since standard smartphone Wi-Fi/Bluetooth chips are physically "deaf" to the 802.15.4 modulation (Thread), we will not attempt to "listen" to the packet data. Instead, we will "feel" the energy footprint of the radio carrier itself.

### The "Seismograph" Analogy:
If Thread is a secret language being spoken in a room, and the Phone is behind a soundproof glass wall, it cannot hear the words. However, if the Speaker (the nRF52840) taps on the glass in a specific rhythm (Morse Code), the Phone can feel the vibrations on the glass and decode the message.

---

## 3. Architecture Component: The "Shadow Pulse" (Transmitter)
**Hardware:** nRF52840 DK (Sensor Node)
**Firmware:** Zephyr RTOS

### Logic:
Every time the sensor node transmits a standard Thread packet, it will immediately trigger a "Shadow Sequence":
1.  **Carrier Strobe:** The firmware will bypass the Thread stack and talk directly to the Radio Peripheral.
2.  **OOK Modulation:** It will turn the 2.4GHz carrier wave ON and OFF in a high-power pattern.
    *   **Preamble:** 3 rapid pulses (The "Wake Up" signal for the phone).
    *   **Data Bits:** 
        *   Long Pulse (100ms) = Binary `1`.
        *   Short Pulse (20ms) = Binary `0`.
3.  **Synchronization:** The pulses will be timed to match the 30-second High-Integrity Cycle of the main telemetry.

---

## 4. Architecture Component: The "Virtual Tap" (Receiver)
**Hardware:** Xiaomi 11T / iPhone 15 Pro Max
**Software:** Android (Termux/Python) or iOS (Web-based Signal Analyzer)

### Logic:
The smartphone will act as a high-frequency energy logger:
1.  **Noise Floor Monitoring:** The app will poll the internal Wi-Fi chip's **RSSI (Received Signal Strength Indicator)** at the highest possible frequency (approx. 50-100 samples per second).
2.  **Pattern Recognition:** A sliding-window algorithm will look for "square waves" in the noise floor that match our specific timing (e.g., 20ms/100ms).
3.  **Threshold Filtering:** The app will ignore standard Wi-Fi noise by looking for the "High-Power Signature" of the DK board held in close proximity (0-1 meters).
4.  **Decoding:** Once the Preamble is detected, the app will capture the bits, convert them to an integer, and display the result (Temperature/CO2).

---

## 5. Frequency Alignment Strategy
To ensure the phone "feels" the energy, we must align the channels:
*   **Wi-Fi Channel 1** centers at **2412 MHz**.
*   **Thread Channel 11** centers at **2405 MHz**.
*   **Action:** We will hardcode the nRF52840 to Channel 11 so its "Shadow Pulses" bleed directly into the phone's Wi-Fi Channel 1 reception buffer.

---

## 6. Implementation Roadmap

### Phase 1: The "Heartbeat" (Firmware Prototype)
*   Update `main.c` to include a raw radio strobe function.
*   **Success Metric:** A Wi-Fi Analyzer app on the Xiaomi shows a clear, rhythmic spike in the "Noise" graph every 30 seconds.

### Phase 2: The "Alphabet" (Encoding Logic)
*   Implement the Bit-to-Pulse converter on the DK.
*   Test with a "Pulse-Train" (e.g., sending the number `101010`).

### Phase 3: The "Seismograph" (Phone App)
*   Write a Python script for **Termux (Android)** that reads `/proc/net/wireless` or uses an NDK-level RSSI hook.
*   Implement the "Shadow Decoder" logic.

### Phase 4: Full-Stack Integration
*   The phone displays: *"REAL-TIME AIR CAPTURE: Temp: 24.5°C | CO2: 800ppm"* without any wires or dongles.

---

## 7. Risks & Mitigation
| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **OS Throttling** | Phone OS might limit RSSI polling to once per second. | Use "Scan Mode" or CSI (Channel State Information) hooks in Android. |
| **RF Interference** | Other Wi-Fi devices might hide the pulses. | Use "Near-Field" testing (hold phone close to DK). |
| **Battery Drain** | High-frequency polling is power-hungry. | Active only during the "Presentation Mode" window. |

---

## 8. Senior Approval
This plan moves the SSNS project from standard IoT into the realm of **Cross-Protocol Communication (CPC)**. It is a "Full-Proof" method because it relies on the physical laws of radio interference rather than restricted software APIs.
