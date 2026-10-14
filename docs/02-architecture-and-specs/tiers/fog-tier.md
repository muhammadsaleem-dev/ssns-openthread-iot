# Fog Tier Architecture

## Overview
The Fog Tier serves as the bridge between the physical 802.15.4 Thread mesh network (Edge Tier) and the centralized Spring Boot API (Backend Tier). It handles protocol translation (CoAP to HTTP), data deserialization (CBOR to JSON), High Availability queueing, and network topology monitoring.

* **Implemented in:** `platform/gateway/main.py` and `edge-nodes/linux-fog-node/docker-compose.fog.yml`.
* **Status:** Active.

## Objectives
* **Mesh Bridging:** Terminate the Thread mesh and bridge it to the local IPv6 network. (Implemented in `Dockerfile.otbr-linux`).
* **Protocol Translation:** Convert CoAP UDP packets from sensor nodes into HTTP POST requests. (Implemented in `platform/gateway/coap/server.py` and `forwarding/http_forwarder.py`).
* **Fault Tolerance:** Ensure no data loss during backend outages via local queueing and deduplication. (Implemented in `forwarding/queue_manager.py`).

## Directory Structure
* `edge-nodes/linux-fog-node/`: Contains the OTBR configuration and Docker orchestration.
* `edge-nodes/mac-fog-node/`: Contains the macOS equivalent for the OTBR configuration.
* `platform/gateway/`: Contains the Python-based Gateway service (`main.py`, `coap/`, `forwarding/`, `telemetry/`).

## Deployment Architecture
* **Implementation:** `edge-nodes/linux-fog-node/docker-compose.fog.yml`.
* **Entry Point:** `docker-compose up`.
* **Dependencies:** Physical USB radio at `/dev/ttyACM0`.
* **Configuration:** `.env` (`GATEWAY_BACKEND_URL`).
The fog tier deploys via Docker Compose using `network_mode: "host"` to allow raw IPv6 and UDP traffic to bypass Docker's NAT bridging.

## Container Architecture
* **OTBR Container:** Runs the OpenThread Border Router (Active).
* **Gateway Container:** Runs the Python CoAP server and HTTP forwarder (Active).
* **Redis Container:** Runs `redis:alpine` for state management (Active).
* **Dependencies:** Gateway depends on Redis (`depends_on: - redis`).

## Startup Sequence
* **Implementation:** `docker-compose.fog.yml` and `platform/gateway/main.py`.
1. **Redis:** Bootstraps first.
2. **OTBR:** Starts concurrently, maps `/dev/ttyACM0`.
3. **Gateway:** Starts, connects to Redis, and launches `worker_loop` and `start_coap_server` concurrently using `asyncio.gather`.

## Infrastructure and Orchestration Subsystem
* **Implementation:** `docker-compose.fog.yml`.
* **Entry Point:** `docker-compose up`.
* **Dependencies:** Docker Engine, `/dev/ttyACM0`.
* **Configuration:** `.env`.
* **Features:** Mounts the physical radio hardware into the OTBR container. Uses `network_mode: "host"` for all containers. (Active).

## Mesh Networking Subsystem
* **Implementation:** `edge-nodes/linux-fog-node/Dockerfile.otbr-linux`.
* **Entry Point:** `/usr/local/bin/linux_startup.sh`.
* **Dependencies:** OTBR image, Radio hardware.
* **Configuration:** `OT_RCP_DEVICE`, `NAT64="0"`, `DNS64="0"`.
* **Features:** Manages the Thread mesh network. Translates 802.15.4 to IPv6. (Active).

## Ingress and Telemetry Processing Subsystem
* **Implementation:** `platform/gateway/coap/server.py`.
* **Entry Point:** `StoreDataResource.render_put()`.
* **Dependencies:** `aiocoap`, `cbor2`.
* **Configuration:** Listens on port `5683`.
* **Features:** Receives CoAP PUT requests. Deserializes CBOR payloads. Reconstructs IPv6 addresses. Supports both "single sample" (Phase 1) and "batch format" (Phase 2). (Active).

## Queueing and State Management Subsystem
* **Implementation:** `platform/gateway/forwarding/queue_manager.py`.
* **Entry Point:** `RedisQueueManager.enqueue()`.
* **Dependencies:** `redis` Python package.
* **Configuration:** `REDIS_URL` (default: `redis://localhost:6379/0`).
* **Features:** Deduplication using `SETNX`, Queueing via Redis `LPUSH`, and Time synchronization state storage. (Active).

## Egress and Forwarding Subsystem
* **Implementation:** `platform/gateway/forwarding/queue_manager.py` (Worker Loop) and `http_forwarder.py`.
* **Entry Point:** `RedisQueueManager.worker_loop()`.
* **Dependencies:** `HttpForwarder`, Backend API.
* **Configuration:** `GATEWAY_BACKEND_URL`.
* **Features:** Pops JSON from Redis queue, maps to `TelemetryReading` class, and executes HTTP POST to the backend. (Active).

## Topology and Health Monitoring Subsystem
* **Implementation:** `edge-nodes/linux-fog-node/scripts/topology_monitor.sh`.
* **Entry Point:** Shell script execution inside OTBR container.
* **Dependencies:** `ot-ctl`, `jq`, `curl`.
* **Configuration:** `POLL_INTERVAL_SECONDS` (default: 15), `GATEWAY_BACKEND_URL`.
* **Features:** Polls `ot-ctl` for Gateway health, Router Table, and Child Table. Parses outputs and POSTs JSON topology to `/api/network/topology`. (Active).

## Redis Integration
* **Implementation:** `docker-compose.fog.yml` and `queue_manager.py`.
* **Entry Point:** `RedisQueueManager.__init__()`.
* **Dependencies:** `redis:alpine` image.
* **Features:** Centralized state for High Availability. Uses `telemetry:queue` (List) for backlog, `telemetry:retry` (Sorted Set) for retries, and `time_sync:<node_id>` (String/JSON) for boot timestamps. (Active).

## CoAP Processing
* **Implementation:** `platform/gateway/coap/server.py`.
* **Entry Point:** `start_coap_server()`.
* **Dependencies:** `aiocoap` library.
* **Features:** Binds to `0.0.0.0:5683`. Responds with `aiocoap.CHANGED` on success or duplicate, and `aiocoap.BAD_REQUEST` on malformed CBOR. (Active).

## CBOR Decoding
* **Implementation:** `platform/gateway/coap/server.py`.
* **Entry Point:** `cbor2.loads(request.payload)`.
* **Dependencies:** `cbor2`.
* **Features:** Distinguishes between Batch format (list of length 2) and Single Sample format (list of length 43). Extracts telemetry arrays into JSON dictionaries. (Active).

## Timestamp Reconstruction
* **Implementation:** `platform/gateway/forwarding/queue_manager.py`.
* **Entry Point:** `RedisQueueManager.enqueue()`.
* **Dependencies:** System clock (`datetime.now(timezone.utc)`).
* **Features:** Calculates absolute boot time by subtracting `uptimeMs` from the current UTC time upon first packet arrival. For historical backlog packets, it adds the historical `uptimeMs` to the anchored boot time. Detects sensor reboots if uptime drops by more than 60,000 ms. (Active).

## Retry Mechanisms
* **Implementation:** `platform/gateway/forwarding/queue_manager.py`.
* **Entry Point:** `_handle_failure()` and `_process_retries()`.
* **Dependencies:** Redis Sorted Sets (`ZADD`, `ZRANGEBYSCORE`).
* **Features:** Exponential backoff calculated as `delay = min(3600, 2 ** current_retry)`. Failed items are stored in `telemetry:retry` with a score equal to `next_retry_time`. (Active).

## Fault Tolerance
* **Implementation:** `platform/gateway/forwarding/queue_manager.py`.
* **Entry Point:** `StoreDataResource.render_put()`.
* **Dependencies:** `redis` SETNX command.
* **Features:** Distributed Deduplication via Redis `SETNX` (key format: `dedup:<node_id>:<boot_id>:<seq_num>`) with a 300-second TTL prevents duplicate processing across replicas. (Active). 

## Monitoring
* **Implementation:** `edge-nodes/linux-fog-node/scripts/topology_monitor.sh`.
* **Entry Point:** Background loop inside OTBR.
* **Dependencies:** `udevadm`.
* **Features:** Automatically discovers the Hardware ID using `udevadm` mapped to the USB device path. Translates Link Quality In (LQIN) from 0-3 scale to a percentage (0-100%). (Active).

## Data Flow
* **Implementation:** Cross-subsystem.
1. `otbr` receives radio waves -> converts to CoAP UDP over IPv6.
2. `server.py` receives CoAP UDP -> parses CBOR to JSON format.
3. `server.py` deduplicates via Redis `SETNX`.
4. `queue_manager.py` reconstructs timestamps -> `LPUSH` into Redis List.
5. `queue_manager.py` (worker) `LPOP`s JSON -> sends via `http_forwarder.py` to Backend.
6. On HTTP failure, `queue_manager.py` routes payload to Redis Sorted Set for retry.

## Limitations
* **Implementation:** `platform/gateway/main.py` & `topology_monitor.sh`.
* The Gateway Python process runs a single threaded `asyncio` event loop. Blocking operations could delay CoAP processing.
* The `topology_monitor.sh` relies on parsing unstructured stdout from `ot-ctl`, making it fragile against CLI output format changes.

## Future Improvements
* Port the Python gateway to a compiled language (e.g., Go/Rust) for higher throughput if the Thread mesh scales massively.
* Use a structured REST/gRPC API for OTBR management rather than regex/awk string parsing of `ot-ctl`.

## Feature Classification Summary
* **Active Features:** CoAP Server, CBOR batch and single decoding, Redis distributed queueing, Exponential backoff retries, Time reconstruction, Duplicate dropping via SETNX, Shell-based Topology monitoring.
* **Deprecated Features:** None identified within the active gateway application code.
* **Assumptions (Omitted):** No external Load Balancers, Kubernetes controllers, or Thread Leader Election logic algorithms were assumed, as they are not explicitly supported by the files in this implementation.
