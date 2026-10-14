# Edge Node Firmware Architecture

## Overview
The Edge Node service (`firmware/sensor-node/`) implements the primary telemetry gathering, processing, and transmission firmware for the Smart Sensor Network System (SSNS). Built on the Zephyr RTOS, it executes on the nRF52840 microcontroller, acquiring environmental data (CO₂, TVOC, PM, Temperature, Humidity) and transmitting compressed statistical batches over an OpenThread mesh network.

## Objectives
- Provide a strict decoupling between physical sensor I/O and network transmission.
- Ensure ultra-low latency (`<1ms`) main loop execution via background asynchronous polling.
- Provide high fault-tolerance against network partitions via local offline buffering.
- Reduce RF overhead by computing statistics locally and compressing payloads using CBOR.

## Architecture
The firmware utilizes a **Dual-Mode Abstraction Architecture**:
1. **Hardware Mode**: Connects to physical I²C sensors, utilizing a multi-threaded asynchronous Aggregator Pattern to prevent blocking.
2. **Simulation Mode**: Mocks sensors using a stochastic random-walk model with simulated blocking latencies (~12s) to facilitate testing without physical hardware.

The active mode is resolved at compile time via Zephyr `Kconfig` variables. Both modes conform to a unified API (`sensor_interface.h`).

## Directory Structure
```text
firmware/sensor-node/
├── src/
│   ├── main.c                    # Main event loop (60s warmup, 6s sampling, 30s batch TX)
│   ├── network.c                 # OpenThread, CoAP communication, and CBOR encoding
│   ├── network.h                 
│   ├── storage.c                 # RAM-backed offline FIFO queue
│   ├── storage.h                 
│   └── sensors/
│       ├── sensor_interface.h    # Common abstraction API
│       ├── sensor_sim.c          # Simulation backend implementation
│       ├── sensor_hw.c           # Hardware backend implementation
│       ├── sensor_aggregator.c   # Multi-threaded polling & shared cache
│       ├── sensor_aggregator.h   
│       └── drivers/              # Wrappers around Zephyr upstream I2C drivers
│           ├── scd41_driver.c    
│           ├── ccs811_driver.c   
│           ├── sps30_driver.c    
├── Kconfig                       # Zephyr configuration variables
├── CMakeLists.txt                # Conditional build targets
├── prj.conf                      # Base configuration (shared)
├── prj_hw.conf                   # Hardware-specific I2C configuration overlay
└── app.overlay                   # Zephyr Devicetree overlay for hardware
```

## Startup Sequence
Implemented in `main.c`:
1. **Subsystem Initialization**: Initializes storage (`storage_init()`) and networking (`network_init()`).
2. **Backend Initialization**: Calls `sensor_backend_init()`. In Hardware mode, this spawns three background polling threads.
3. **OpenThread Attachment**: Enforces a 5-second initial sleep `k_sleep(K_SECONDS(5))` to allow mesh attachment.
4. **Silent Start (Warm-up)**: The main loop enforces a 60-second blocking window (`uptime_ms < 60000`). During this window, it sleeps for 10 seconds at a time (`k_sleep(K_SECONDS(10))`), skipping network transmissions. This guarantees that all background sensor threads (particularly the SCD41, which takes 5.5s per read) have populated the shared cache before the first CoAP transmission.

## Configuration
- **Simulation (Default)**: `CONFIG_SENSOR_MODE_SIMULATION=y`
- **Hardware Mode**: Overridden via `-DCONFIG_SENSOR_MODE_HARDWARE=y` and `-DEXTRA_CONF_FILE=prj_hw.conf`.
- **Constants (`main.c`)**:
  - `SAMPLE_INTERVAL_MS = 6000` (6 seconds).
  - `TRANSMIT_INTERVAL_MS = 30000` (30 seconds).
  - `BATCH_SIZE = 5` samples.

## Sensor Abstraction Layer
Implemented via `sensor_interface.h`. Defines an opaque `struct sensor_context` and provides three core functions:
- `sensor_backend_init(struct sensor_context **ctx)`
- `sensor_backend_read(struct sensor_context *ctx, struct sensor_readings *out)`
- `sensor_backend_deinit(struct sensor_context *ctx)`

## Threading Model
In Hardware mode (`sensor_aggregator.c`), the Zephyr RTOS spawns three dedicated background threads to poll I²C sensors concurrently, avoiding blocking the main execution thread:
- **`scd41_poll`**: Thread priority 7. Sleeps 5.5s (`k_sleep(K_MSEC(5500))`) between reads.
- **`ccs811_poll`**: Thread priority 7. Sleeps 1.0s (`k_sleep(K_SECONDS(1))`) between reads.
- **`sps30_poll`**: Thread priority 7. Sleeps 1.5s (`k_sleep(K_MSEC(1500))`) between reads.

## Sensor Aggregation
The three background threads aggregate data into a shared static memory structure (`static struct sensor_readings cache;`) located in `sensor_aggregator.c`. 
- **Synchronization**: Concurrency is managed via a Zephyr Mutex (`k_mutex cache_mutex`). Threads acquire the lock (`k_mutex_lock(&cache_mutex, K_FOREVER)`), update the structure, and immediately release it.
- **Retrieval**: The main thread calls `sensor_aggregator_get()`, which acquires the mutex, performs a highly efficient struct copy (`*out = cache;`), and releases it, executing in `<1ms`.

## Statistical Processing
Statistical processing is executed directly on the Edge Node (`sensor_aggregator.c`) within the `stats_calculate()` function over a rolling circular buffer of `SENSOR_STATS_BUFFER_SIZE` (30 samples).
- **Mean (Average)**: Calculated using `O(n)` iteration: `mean = sum(x) / n`.
- **Standard Deviation (Two-Pass)**: Calculated via a naive two-pass algorithm. After computing the mean, the function performs a second iteration to compute population variance: `std = sqrt(sum((x - mean)^2) / n)`.
- **Maximum**: Discovered via `O(n)` iteration: `max = max(x_0, x_1, ..., x_{n-1})`.

## Fault Tolerance
Implemented extensively across `sensor_aggregator.c` and `network.c`:
- **Graceful Degradation (Health Mask)**: The `sensor_readings` struct contains an 8-bit `health_mask`. Bits include `SENSOR_HEALTH_TEMP_HUM`, `SENSOR_HEALTH_CO2`, `SENSOR_HEALTH_PM`, and `SENSOR_HEALTH_TVOC`. If an I²C read fails, the thread clears its specific bit and sets its value to `SENSOR_FAULT_VALUE` (-999.0f). Other threads remain unaffected.
- **Warm-up States**: The CCS811 requires a 20-minute thermal warmup. `ccs811_thread_fn` detects `d.warming_up`, sets values to `SENSOR_WARMUP_VALUE` (-998.0f), and clears the health bit. This prevents false anomalies.
- **Maintenance States**: The SPS30 runs periodic fan-cleaning cycles (10s every 168h). `sps30_thread_fn` detects `d.fan_cleaning`, preserves the current health bit exactly as-is, and outputs the last known good value.
- **Network Retries**: `network.c` evaluates consecutive transmission failures. If `consecutive_failures >= MAX_CONSECUTIVE_FAILURES` (3), `network_reset_stack()` forcefully detaches and re-attaches the OpenThread stack (`otThreadSetEnabled(false -> true)`) to trigger a new parent search.

## Offline Storage
Implemented in `storage.c` as a Store-and-Forward RAM Queue:
- **Data Structure**: Circular array `uint8_t packet_queue[QUEUE_MAX_ITEMS][PACKET_SLOT_SIZE]`.
- **Capacity**: `QUEUE_MAX_ITEMS` = 50 packets; `PACKET_SLOT_SIZE` = 1024 bytes. At 1 batch per 30 seconds, this yields exactly 25 minutes of complete offline coverage.
- **Behavior**: Upon network failure, `main.c` calls `storage_save_packet()`. When connectivity is restored, `storage_forward_all_packets()` drains the queue, transmitting payloads via `network_send_raw_payload()`.

## OpenThread Integration
Implemented in `network.c`:
- **Custom Dataset Injection**: `force_thread_dataset()` overrides Flash states by injecting a hardcoded Thread dataset (Channel 26, PanId 0x1235) with a highly elevated `mActiveTimestamp` (Year 2033) to guarantee authoritative propagation.
- **Topology Awareness**: `network_send_coap_batch()` inspects `otThreadGetDeviceRole()`. If the role is `OT_DEVICE_ROLE_DETACHED` or `OT_DEVICE_ROLE_DISABLED`, or if neighbors are 0, it entirely suppresses RF transmission to prevent broadcast storms.

## CoAP Communication
Implemented in `network.c`:
- **Protocol**: CoAP over UDP/IPv6. Target is `fd5e:a726:ec55:ee12::1:5683`.
- **URI Path**: `"storedata"`.
- **ACK Timeout**: The `wait_for_coap_ack()` function utilizes `poll()` to block for up to 5,000ms. If the Gateway does not reply with an explicit CoAP ACK (Type 2 matching the `msg_id`), it returns `-ETIMEDOUT`.

## CBOR Serialization
Implemented using Zephyr's `zcbor` library inside `network_encode_coap_batch()`:
- **Format**: Flat array structures mapped sequentially.
- **Schema**:
  - `Root Array [2 elements]` -> `[Samples Array, Statistics Map]`.
  - `Samples Array`: Iterates through the batch. Each sample is an array of 16 elements (Node ID, Boot ID, Sequence Num, Uptime, 10 Sensor Values, Health Mask, Mesh ID).
  - `Statistics Map`: A 27-element map comprising the Mean, Standard Deviation, and Max for all 9 sensor channels, derived from the last sample's 3-minute rolling buffer.

## Data Flow
1. **Acquisition**: `scd41`, `ccs811`, `sps30` background threads -> `cache_mutex` -> `cache`.
2. **Main Loop (6s)**: `main.c` calls `sensor_backend_read()` -> buffers into `sample_buffer[5]`.
3. **Transmission (30s)**: `network_encode_coap_batch()` -> `last_payload`.
4. **Routing**: If `network_send_coap_batch()` succeeds, drain offline queue. If it fails, save `last_payload` to `packet_queue` via `storage_save_packet()`.

## Monitoring
- **Hardware Health**: Continually transmitted via the `health_mask` bitmask integer in the CBOR payload.
- **Gateway Connectivity**: `network_is_gateway_reachable()` assesses connectivity using `consecutive_failures` and time elapsed since `last_successful_send`.
- **Log Outputs**: `LOG_MODULE_REGISTER` emits critical system states (e.g., `"CRITICAL: Zephyr Network RAM Buffer is FULL!"`).

## Limitations
- **Naive Variance Calculation**: The two-pass standard deviation algorithm risks floating-point truncation errors on very large samples, although mitigated by the small `n=30` window constraint.
- **RAM-bound Queue**: The Phase 3.1 `packet_queue` is stored entirely in volatile RAM. A complete power loss during an extended network outage will cause irretrievable data loss for queued packets.
- **Lack of Time Synchronization**: The system uses `k_uptime_get_32()` (milliseconds since boot) for timestamps, requiring the Gateway backend to estimate absolute chronometric times based on packet receipt arrival.

## Future Improvements
- Implement Welford's Online Algorithm to calculate standard deviation in a single pass (`O(1)` space and `O(1)` time per sample).
- Migrate the `storage.c` offline queue to use Zephyr's NVS (Non-Volatile Storage) on Flash memory to survive power cycles.
- Integrate SNTP (Simple Network Time Protocol) to fetch real UTC timestamps over the OpenThread border router upon initialization.

---

### Feature Classification Summary

**Implemented Features:**
- Dual-mode architecture (Sim/Hardware)
- Asynchronous Thread-based Sensor Aggregator (`k_thread`, `k_mutex`)
- CoAP over OpenThread transmission
- Advanced CBOR batch encoding
- Offline RAM queuing
- 4-bit Health Masking and Graceful Degradation
- Two-Pass Standard Deviation processing

**Experimental Features:**
- None detected. The codebase operates entirely on deterministic, production-targeted logic.

**Deprecated Features:**
- Flash-backed NVS storage (Deprecated in Phase 3.1 in favor of the simplified RAM Queue to prevent Settings API/Flash conflict bugs with OpenThread).
