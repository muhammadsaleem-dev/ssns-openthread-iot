# Gateway Service Layer: Protocol Translation, Queueing & Time Synchronization

This document details the architectural design, asynchronous processing pipeline, and algorithmic implementations within the Python Gateway Middleware Service (`platform/gateway`).

---

## Executive Summary

The **Gateway Service Layer** acts as an asynchronous, fault-tolerant middleware application designed to bridge low-power wireless edge networks (OpenThread / IEEE 802.15.4) with upstream IP-based backend infrastructure. 

Operating at the network boundary, the gateway resolves three fundamental engineering challenges inherent to constrained wireless networks:
1. **Protocol & Encoding Translation**: Terminating low-overhead User Datagram Protocol (UDP) CoAP requests carrying binary CBOR payloads and translating them into standard HTTP POST requests with JSON formatting.
2. **Offline Resilience & Deduplication**: Buffering telemetry in a persistent Redis queue during upstream cloud disconnections and filtering retransmitted packets caused by wireless packet loss.
3. **Microcontroller Time Synchronization**: Mitigating internal hardware oscillator drift on edge microcontrollers by dynamically anchoring timestamps for live packets while accurately reconstructing historical timestamps for backlogged data.

---

## 💡 Viva & Defense Quick Reference (30-Second Summary)

When explaining the Gateway Service during your oral defense or presentation, use this concise summary:

> *"Our Python Gateway acts as an asynchronous bridge between the low-power 802.15.4 mesh and our cloud backend.*
> 
> *It receives lightweight CoAP packets containing compressed binary CBOR data, decodes them, and pushes them into a local Redis queue. This decouples radio reception from cloud forwarding, ensuring zero data loss even if the internet goes down.*
> 
> *To prevent microcontroller hardware clock drift over weeks of uptime, our gateway implements a dynamic time-anchoring algorithm that stamps live arriving packets with current UTC time while using relative uptime offsets only for backlogged historical packets."*

### Key Viva Q&A
* **Q: Why use a local Redis queue on the Gateway?**
  * **A:** To decouple the high-speed radio reception from cloud HTTP requests. If the internet connection to the cloud VPS drops, the gateway buffers thousands of sensor readings locally in Redis and forwards them automatically once connectivity is restored.
* **Q: How does the Gateway handle hardware timer drift on the microcontroller?**
  * **A:** Microcontroller internal RC timers often drift over time. For live packets (where incoming uptime equals or exceeds the highest recorded uptime), the gateway stamps the packet with the exact current UTC time and resets the boot time anchor (`boot_time = now - uptime`). Relative timestamp reconstruction is reserved exclusively for delayed backlog packets.

---

## 1. Asynchronous Ingestion & Protocol Translation

To maximize battery longevity, edge sensor nodes transmit data over UDP using the **Constrained Application Protocol (CoAP)** and compress payloads using **Concise Binary Object Representation (CBOR)**.

### 1.1 CoAP Resource Termination
The gateway executes an asynchronous `aiocoap` server (`platform/gateway/coap/server.py`) listening on standard port `5683`. When an edge node transmits a CoAP Confirmable (`CON`) PUT request to `/api/sensor-data`:
1. The gateway immediately acknowledges (`ACK`) the packet at the transport layer, preventing the sensor node's radio from staying awake for retry attempts.
2. The raw payload bytes are passed to the CBOR deserializer (`cbor2.loads`), converting tight binary structures into native Python dictionaries.

---

## 2. Redis Persistent Queueing & Deduplication

In distributed IoT deployments, cloud network latency or temporary WAN outages must not obstruct local radio ingestion.

### 2.1 FIFO Ingestion Queue
Instead of forwarding packets synchronously to the cloud backend (which blocks the asynchronous event loop during network slowdowns), the CoAP server pushes decoded telemetry into a local **Redis FIFO Queue** (`telemetry:queue`) via `lpush`.

### 2.2 Background Forwarding Workers
Dedicated background worker threads (`platform/gateway/forwarding/http_forwarder.py`) continuously monitor the Redis queue using non-blocking operations (`rpop`). When items are available, the worker formats the data into JSON and transmits an HTTP POST request to the upstream REST API (`/api/sensor-data`).

---

## 3. Microcontroller Time Synchronization & Drift Compensation

Constrained edge microcontrollers (e.g., nRF52840, ESP32) frequently lack real-time clocks (RTC) with battery backup or cellular NTP synchronization. Instead, nodes report a monotonic hardware counter representing milliseconds since boot (`uptimeMs`).

### 3.1 The Oscillator Drift Problem
Over extended operating periods (24+ hours), internal microcontroller oscillators drift slightly relative to true UTC wall time. If a gateway rigidly calculates packet timestamps using a fixed, historical boot time anchor:
$$\text{Timestamp} = \text{FixedBootTime} + \frac{\text{uptimeMs}}{1000}$$
Any slight divergence in oscillator speed accumulates over time, causing newly arrived live packets to be artificially stamped minutes or hours into the past or future.

### 3.2 Dynamic Live Anchor Algorithm
To maintain long-term timestamp accuracy without requiring bidirectional NTP over the low-power mesh, the gateway implements a dynamic anchoring algorithm inside `platform/gateway/forwarding/queue_manager.py`:

```python
if current_uptime >= (max_uptime - 2000):
    # Live arriving packet (newest reading or within 2 seconds of newest)
    # Stamp with current UTC time so hardware timer drift never drags timestamps into the past
    max_uptime = max(max_uptime, current_uptime)
    known_boot_time = now.timestamp() - (current_uptime / 1000.0)
    data['timestamp'] = now.isoformat()
else:
    # Historical backlog packet (buffered during offline outage)
    packet_timestamp = known_boot_time + (current_uptime / 1000.0)
    data['timestamp'] = datetime.fromtimestamp(packet_timestamp, tz=timezone.utc).isoformat()
```

### 3.3 Algorithm Behavior
* **Live Packets**: When an incoming packet's uptime equals or exceeds the maximum known uptime for that node (`current_uptime >= max_uptime - 2000`), the gateway identifies it as a live, real-time transmission. It stamps the packet with exact current UTC time (`now.isoformat()`) and continuously refreshes the node's `known_boot_time` anchor in Redis.
* **Backlog Packets**: When packets arrive with an uptime significantly lower than `max_uptime` (e.g., historical readings flushed after a network recovery), the gateway reconstructs their precise historical occurrence time using the stored `known_boot_time` anchor.
