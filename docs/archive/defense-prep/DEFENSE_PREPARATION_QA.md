# Project Defense & Interview Preparation Q&A

This document contains likely questions you will face during a thesis defense, technical review, or engineering interview regarding your OpenThread IoT Architecture. Memorizing the concepts behind these answers will demonstrate that you have a deep, full-stack understanding of embedded systems, networking, and data science.

---

## Section 1: Hardware & RTOS (Zephyr on nRF52840)

**Q1: Why did you choose Zephyr RTOS instead of something simpler like Arduino or FreeRTOS?**
**Answer:** Zephyr is an industry-grade, highly scalable RTOS backed by the Linux Foundation. Unlike Arduino, it provides native, deeply integrated support for advanced networking stacks like OpenThread. It also enforces strict memory management and power management, which is critical for low-power IoT devices. Using Zephyr demonstrates a commitment to commercial-grade engineering rather than just building a prototype.

**Q2: You calculate standard deviations locally. Doesn't doing heavy math drain the battery on a microcontroller?**
**Answer:** I specifically targeted the nRF52840 chip because it features an ARM Cortex-M4F processor, which includes a hardware Floating Point Unit (FPU). It can perform complex math (like square roots for standard deviations) in just a few clock cycles. The battery energy required to do this math is negligible compared to the massive energy cost of turning on the radio transmitter. By calculating stats locally, we send smaller, fewer packets, actually *saving* battery life.

---

## Section 2: Networking (OpenThread & CoAP)

**Q3: Most IoT projects use WiFi and MQTT. Why did you choose OpenThread and CoAP?**
**Answer:** WiFi uses too much power for battery-operated sensors, and standard Bluetooth cannot easily form a self-healing mesh. OpenThread provides a robust, low-power, self-healing IPv6 mesh network. It's the exact same protocol Apple and Google use for the "Matter" smart home standard. Because OpenThread operates over UDP, CoAP is the perfect lightweight application protocol, as it is designed specifically for constrained networks with high packet-loss potential, unlike TCP-based MQTT.

**Q4: How do you handle a node temporarily losing connection to the mesh?**
**Answer:** The firmware is designed to buffer critical data to the non-volatile flash storage when the CoAP transmission fails. Once the OpenThread mesh heals or the node reconnects, a queue manager flushes the buffered packets to the gateway, ensuring no critical telemetry is lost during transient RF interference.

---

## Section 3: Edge Computing (The 3-Minute Rolling Context)

**Q5: Why aggregate data into a 3-minute rolling window instead of just sending data every 10 seconds?**
**Answer:** Sending raw data every 10 seconds clogs the RF bandwidth and drains the battery. Furthermore, a single 10-second spike might just be hardware noise. By maintaining a 3-minute circular buffer and transmitting the `mean`, `max`, and `standard deviation`, the edge node acts as a mathematical Low-Pass Filter. It smooths out false hardware glitches while still preserving the true "context" and highest peaks of the room's environment.

**Q6: How much RAM does your 3-minute circular buffer consume? Is it safe?**
**Answer:** It is extremely memory efficient. If we sample every 5 seconds, a 3-minute window holds exactly 36 samples per sensor. A float is 4 bytes, so `36 * 4 = 144 bytes`. Even tracking 5 different sensors requires less than 1 Kilobyte of RAM. Since the nRF52840 has 256KB of RAM, this leaves plenty of memory for the Zephyr kernel and OpenThread network stack without risking a stack overflow.

---

## Section 4: Backend & Machine Learning

**Q7: Why use an Isolation Forest in your Python `ml-service` instead of basic thresholds?**
**Answer:** Hardcoded thresholds (e.g., "Alert if Temp > 30°C") fail because different rooms have different baselines. An Isolation Forest is an unsupervised anomaly detection algorithm that learns the unique distribution of each specific sensor node automatically. If a server room normally runs hot, the Isolation Forest learns that baseline and only flags data that behaves anomalously *for that specific room*, virtually eliminating false positives.

**Q8: Why not run the Isolation Forest on the Edge (the Zephyr node) instead of the Backend?**
**Answer:** While TinyML is possible, maintaining separate Isolation Forest baselines directly on the edge nodes introduces significant firmware complexity and memory overhead. By keeping the ML centralized on the backend, we leverage cloud-tier CPU power and keep the edge firmware beautifully simple and purely focused on data aggregation and transmission. The Edge handles the *speed* (acute alerts via max values), while the Backend handles the *intelligence* (chronic drift via machine learning).
