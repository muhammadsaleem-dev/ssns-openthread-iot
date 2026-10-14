# Executive Summary: Edge Layer Architecture

This document summarizes the technical design, core features, and reliability mechanisms implemented on our **Edge Layer** (the hardware sensor nodes).

---

## Overview
Our hardware sensor nodes do not just send raw numbers over the network. Instead, they are programmed in C to pre-process sensor data locally using the chip's built-in **ARM Floating-Point Unit (FPU)**. The firmware filters out natural measurement noise, enforces automatic manufacturer calibration rules, and protects the system against disconnected wires and network drops.

---

## Key Technical Achievements

### 1. Embedded Statistical Pre-Processing (ARM FPU)
Rather than transmitting raw sensor numbers, the microcontroller pre-computes time-series summary statistics locally. It maintains a continuous 3-minute rolling window (30 circular samples) and executes a numerically stable Two-Pass Algorithm using the physical **ARM Floating-Point Unit (FPU)**. This extracts exact rolling **Means ($\mu$)**, **Standard Deviations ($\sigma$)**, and **Maximums ($\max$)**, providing downstream analytics with structured trend variance directly from the chip.

### 2. Built-in Hardware Calibration
To ensure sensors remain accurate over time without manual field maintenance, the firmware follows manufacturer datasheet rules:
* **SCD41 (CO2):** Uses Automatic Self-Calibration (ASC) based on a 7-day outdoor air baseline.
* **CCS811 (TVOC):** Automatically blocks unreliable data for the first 20 minutes after booting and discards internal hardware error codes (`0xFDFD`).
* **SPS30 (Particulates):** Runs an automated weekly 10-second fan cleaning cycle to blow away accumulated dust.

### 3. Hardware Fault Isolation (Health Vector)
If a physical sensor wire unplugs or loses power, standard embedded loops freeze forever. Our firmware prevents this by using a strict timeout and assigning each sensor a bit inside a transmitted `health_vector` byte. If a sensor fails, the firmware clears its specific health bit and sends fallback data. This allows the backend to trigger a maintenance alert without losing data from the working sensors on that node.

### 4. Network Self-Healing & RAM Buffering
Our wireless mesh network (**OpenThread IPv6**) occasionally experiences dropped packets during routing updates. The firmware tracks every CoAP Confirmable message with a 5-second confirmation timer. If transmission fails, the data batch is saved into a local 50-slot RAM buffer. If three consecutive failures occur, the node automatically resets its OpenThread radio stack to search for and connect to another available Fog node (Gateway Host) in our distributed topology.

### 5. Degraded Operation & Total Outage Resilience
If a building-wide network failure occurs or all distributed Fog gateways go offline simultaneously, edge nodes enter an autonomous survival mode:
* **Short-Term Outages (<25 min):** Data batches are safely buffered inside local RAM circular queues with zero data loss.
* **Extended Outages (>25 min):** The circular buffer gracefully overwrites the oldest stored record. The microcontroller operates continuously without memory crashes, always retaining the most recent 25 minutes of environmental history.
* **Autonomous Recovery:** Nodes continuously broadcast radio discovery requests. The exact moment any Fog gateway returns online, edge nodes autonomously reconnect and flush all buffered telemetry upstream.

---

## Summary of Benefits
* **Network Efficiency:** Packaging 30 raw readings into compressed CBOR binary batches reduces radio network bandwidth consumption by over 80%.
* **Data Quality:** Fault isolation ensures corrupted readings never reach our central database.
* **Connection Reliability:** Local RAM buffering safely preserves up to 25 minutes of sensor data if the gateway connection temporarily drops.
