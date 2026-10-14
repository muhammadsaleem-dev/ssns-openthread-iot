# 🌁 SSNS Fog Layer Architecture & Ingestion Overview

The **Fog Gateway Layer** serves as the vital processing bridge between our low-power wireless **Thread Edge Sensors** and our central **Backend Server (Local or Cloud)**. 

Rather than sending raw radio signals directly over the network, the Fog Node operates locally at the edge to terminate radio traffic, decode binary payloads, filter out duplicate packets, and reliably forward structured JSON data to our target database environment.

---

## 📐 End-to-End Data Pipeline

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 1. EDGE SENSOR LAYER                                   │
│                                                                                        │
│   [ nRF52840 Sensor Node ] ──( CBOR over CoAP / Thread Radio Mesh )──┐                 │
└──────────────────────────────────────────────────────────────────────┼─────────────────┘
                                                                       │
                                                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 2. FOG GATEWAY LAYER                                   │
│                                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────────────────────┐   │
│   │   OpenThread Border       │ ───► │        Python Asynchronous CoAP Server      │   │
│   │   Router (OTBR & RCP Dongle)│    │        (Listens on Port 5683)               │   │
│   └───────────────────────────┘      └──────────────────────┬──────────────────────┘   │
│                                                             │                          │
│                                      CBOR to Dict Decoding  │                          │
│                                                             ▼                          │
│                                      ┌─────────────────────────────────────────────┐   │
│                                      │           Redis Deduplication Cache         │   │
│                                      │        (Discards duplicates within 60s)     │   │
│                                      └──────────────────────┬──────────────────────┘   │
│                                                             │                          │
│                                       Unique Telemetry Buffer│                          │
│                                                             ▼                          │
│                                      ┌─────────────────────────────────────────────┐   │
│                                      │          Asynchronous HTTP Forwarder        │   │
│                                      └──────────────────────┬──────────────────────┘   │
└─────────────────────────────────────────────────────────────┼──────────────────────────┘
                                                              │
                                      HTTP POST (JSON Payloads)│
                                                              ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                           3. UPSTREAM BACKEND LAYER (Local or Cloud)                   │
│                                                                                        │
│                                 [ Backend REST API / MongoDB ]                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Core Components & Team Responsibilities

| Component | Primary Responsibility | Why We Built It This Way |
| :--- | :--- | :--- |
| **OpenThread Border Router (OTBR)** | Terminates the physical `wpan0` IPv6 wireless Thread mesh via our connected nRF52840 Radio Co-Processor (RCP) dongle. | Converts low-energy IEEE 802.15.4 radio frames into standard, routable IPv6 packets. |
| **Python CoAP Ingestion Server** | Terminates incoming **CoAP Confirmable (CON) PUT** requests sent by sensor nodes every 30 seconds. | Instantly returns a lightweight UDP CoAP ACK back to the physical sensors so they can re-enter ultra-low-power sleep modes. |
| **CBOR Deserializer** | Unpacks compact binary CBOR payloads into rich, structured key-value telemetry objects. | CBOR compression reduces over-the-air packet sizes by more than 60%, drastically cutting radio transmission time and collisions. |
| **Redis Deduplication Engine** | Inspects message IDs and payload signatures against a local in-memory Redis cache with a 60-second TTL window. | In lossy wireless environments, dropped ACKs cause sensors to retransmit duplicate payloads. Redis intercepts and drops duplicates before they reach analytics. |
| **Async HTTP Forwarding Queue** | Enqueues validated telemetry objects and dispatches standard `HTTP POST` requests (`/api/v1/telemetry`) to our target server. | Completely decouples local radio reception from upstream network latency. If server responses are slow, local radio traffic remains unblocked. |

---

## 🎯 Key Architectural Advantages for Our System

1. **Energy Conservation:** By allowing edge sensors to transmit compact binary CBOR over UDP/CoAP rather than bulky HTTPS/JSON, sensor battery lifespan is significantly extended.
2. **Network Resilience:** The local buffering mechanism ensures that even if upstream server connectivity drops momentarily, incoming sensor telemetry is preserved locally and forwarded once the network recovers.
3. **Clean Analytics:** Our 2-stage verification (CoAP ACK termination + Redis deduplication) ensures that 100% of telemetry reaching our target database is unique, timestamp-accurate, and uncorrupted regardless of deployment location.
