# Fog Layer Architecture & Ingestion Pipeline

This document details the architectural design, responsibilities, and data flow of the **Fog Gateway Layer** within the SSNS IoT Project. It serves as the official reference for team members preparing final reports or system defenses.

---

## 1. Executive Summary & Role
The Fog Layer acts as the critical bridge between the low-power wireless **OpenThread Mesh Network** (Edge) and the **backend**. 

Running on gateway hardware (e.g., an embedded SBC or developer Host Machine), its primary responsibility is to ingest raw binary radio frames, translate protocols (CoAP to HTTP / CBOR to JSON), filter network anomalies, and ensure guaranteed delivery to the upstream backend.

```
[ Edge Sensor Nodes ] ──(Thread / CoAP / CBOR)──► [ Fog Gateway (OTBR) ] ──(HTTP POST / JSON)──► [ Central Backend ]
```

---

## 2. Core Architectural Components

### A. OpenThread Border Router (OTBR & RCP Dongle)
* **Physical Radio Interface:** An **RCP (Radio Co-Processor) USB Dongle** (e.g., nRF52840) is plugged directly via USB into the Fog Host Machine. The OTBR daemon communicates with this dongle over a high-speed serial Spinel protocol to create the virtual wireless interface (`wpan0`) terminating the IPv6 Thread mesh network.
* **Ingestion Address:** Listens on the standardized gateway IPv6 address `fd5e:a726:ec55:ee12::1:5683`.

### B. Python Asynchronous CoAP Server
* **Function:** Terminates incoming **CoAP Confirmable (CON) PUT** requests sent by edge nodes every 30 seconds.
* **CBOR Decoding:** Edge nodes transmit data using **CBOR (Concise Binary Object Representation)** to conserve radio bandwidth. The Fog CoAP server instantly decodes these binary payloads into standard Python dictionaries.

### C. Redis Deduplication Engine
* **The Problem:** In wireless mesh topologies, dropped ACK packets frequently cause edge nodes to retransmit duplicate data batches.
* **The Mitigation:** Before processing a payload, the Fog node extracts the unique message identifier (or computes a payload hash) and queries a local **Redis Cache**. If the key exists within a 60-second TTL window, the duplicate packet is silently discarded. This prevents duplicate data from corrupting backend analytics.

### D. Asynchronous Worker Threads & Queue
* **Function:** Decoded, unique telemetry is placed into an in-memory thread-safe queue. Dedicated background worker threads pop payloads from this queue and dispatch standard **HTTP POST JSON** requests to the backend API.
* **Resilience:** Decoupling CoAP reception from HTTP forwarding ensures that slow backend API responses do not block incoming radio traffic.

---

## 3. Step-by-Step Data Packet Journey

1. **Radio Reception:** OTBR receives an IEEE 802.15.4 frame over the Thread mesh.
2. **CoAP Termination:** Python server intercepts the CoAP Confirmable PUT and dispatches an immediate CoAP ACK back to the sensor node (preventing edge retry timeouts).
3. **Payload Translation:** CBOR binary payload is deserialized into structured telemetry containing rolling statistical Means, Standard Deviations, and Maximums.
4. **Deduplication Check:** Redis is queried. If duplicate, abort. If unique, register key with 60s TTL.
5. **Queue Ingestion:** Telemetry object enqueues into local memory buffer.
6. **Upstream Forwarding:** Worker thread dequeues object, formats JSON payload, and HTTP POSTs to `http://backend-api:8080/api/v1/telemetry`.

---

## 4. Key Presentation Defenses (Why we built it this way)

* **Why CBOR over CoAP instead of HTTP/JSON directly from the sensor?**
  > *"Edge microcontrollers have restricted battery and MTU payload sizes. CBOR binary encoding reduces packet sizes by ~60%, allowing 5 statistical sensor readings to fit inside a single radio transmission."*
* **Why use Redis at the Fog layer?**
  > *"Wireless mesh routing retries inevitably generate duplicate packets. Handling deduplication at the Fog layer protects the central database from redundant processing and prevents skewed statistical averages."*
* **What happens if the Central Backend goes offline?**
  > *"Because we decoupled ingestion using an asynchronous queue, the Fog gateway acts as a shock absorber. It buffers incoming sensor batches locally in RAM/disk until upstream connectivity is restored."*
