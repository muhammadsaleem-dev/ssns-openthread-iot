# SSNS Sensor Node - Current Architecture Documentation

**Document Version**: 1.0  
**Last Updated**: 2026-06-12  
**Firmware Version**: Dual-Mode (Simulation + Hardware)

---

## 📋 Executive Summary

The SSNS Sensor Node firmware implements a **dual-mode architecture** that supports both simulated and real hardware sensors through compile-time mode selection. The system uses a clean abstraction layer that allows seamless switching between modes without changing application code.

**Key Features**:
- ✅ **Dual-mode operation**: Simulation (default) or Hardware (real sensors)
- ✅ **Zero runtime overhead**: Compile-time mode selection via Kconfig
- ✅ **Multi-threaded sensor polling**: Independent threads per sensor (hardware mode)
- ✅ **Non-blocking reads**: Aggregator cache pattern (hardware mode)
- ✅ **Graceful degradation**: Continues with remaining sensors if one fails
- ✅ **Health monitoring**: 4-bit status mask tracks sensor health
- ✅ **Offline queue**: NVS-backed storage for network outages
- ✅ **CBOR encoding**: Compressed telemetry (~88 bytes vs ~200 bytes JSON)

---

## 🏗️ System Architecture Overview

### High-Level Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         MAIN APPLICATION                         │
│                          (main.c)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. Initialize sensor backend (simulation or hardware)     │ │
│  │  2. 60-second warm-up period                               │ │
│  │  3. Loop every 30 seconds:                                 │ │
│  │     - Read sensors (via sensor_interface.h)                │ │
│  │     - Send CoAP packet                                     │ │
│  │     - On failure: save to NVS queue                        │ │
│  │     - On success: drain NVS queue                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────────┐          ┌────────────────────┐
│  SENSOR BACKEND   │          │  NETWORK LAYER     │
│ (sensor_interface)│          │   (network.c)      │
├───────────────────┤          ├────────────────────┤
│ • Simulation Mode │          │ • CoAP encoding    │
│ • Hardware Mode   │          │ • CBOR payload     │
│                   │          │ • Thread/OpenThread│
│ Returns:          │          │ • ACK waiting      │
│ sensor_readings   │          │ • Gateway comms    │
└───────────────────┘          └────────────────────┘
        │                               │
        │                               ▼
        │                      ┌────────────────────┐
        │                      │  STORAGE LAYER     │
        │                      │   (storage.c)      │
        │                      ├────────────────────┤
        │                      │ • NVS queue        │
        │                      │ • Offline buffering│
        │                      │ • FIFO management  │
        │                      └────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│              MODE SELECTION (Kconfig)                            │
├─────────────────────────────────────────────────────────────────┤
│  CONFIG_SENSOR_MODE_SIMULATION  │  CONFIG_SENSOR_MODE_HARDWARE  │
│  (default)                       │  (with prj_hw.conf)           │
└─────────────────────────────────────────────────────────────────┘
        │                                       │
        ▼                                       ▼
┌──────────────────────┐          ┌────────────────────────────────┐
│  SIMULATION BACKEND  │          │     HARDWARE BACKEND           │
│  (sensor_sim.c)      │          │     (sensor_hw.c)              │
├──────────────────────┤          ├────────────────────────────────┤
│ • Random walk model  │          │ • Delegates to aggregator      │
│ • Baseline drift     │          │ • Non-blocking cache read      │
│ • Trend events       │          │                                │
│ • Failure injection  │          │   ┌────────────────────────┐   │
│ • Blocking latencies │          │   │  SENSOR AGGREGATOR     │   │
│   (12s total)        │          │   │  (sensor_aggregator.c) │   │
│                      │          │   ├────────────────────────┤   │
│ No hardware required │          │   │ • 3 polling threads    │   │
└──────────────────────┘          │   │ • Mutex-protected cache│   │
                                  │   │ • Independent polling  │   │
                                  │   └────────┬───────────────┘   │
                                  │            │                   │
                                  │            ▼                   │
                                  │   ┌────────────────────────┐   │
                                  │   │   HARDWARE DRIVERS     │   │
                                  │   ├────────────────────────┤   │
                                  │   │ • scd41_driver.c       │   │
                                  │   │ • ccs811_driver.c      │   │
                                  │   │ • sps30_driver.c       │   │
                                  │   │                        │   │
                                  │   │ Wraps Zephyr upstream  │   │
                                  │   │ sensor drivers         │   │
                                  │   └────────────────────────┘   │
                                  └────────────────────────────────┘
```

---

## 🔄 Data Flow Comparison

### Simulation Mode: Blocking Reads

```
main() → sensor_backend_read() [BLOCKS 12s]
  ├─ 100ms:  Read Temp/Hum (with 15% failure chance)
  ├─ 10000ms: Read CO₂ (with 15% failure chance)
  ├─ 1000ms: Read PM (with 15% failure chance)
  └─ 1000ms: Read TVOC (with 15% failure chance)
  → Returns sensor_readings
  → network_send_coap()
```

### Hardware Mode: Non-Blocking Reads

```
Background Threads (continuous):
  ├─ scd41_poll:  Every 5.5s → Update cache
  ├─ ccs811_poll: Every 1.0s → Update cache
  └─ sps30_poll:  Every 1.5s → Update cache

main() → sensor_backend_read() [<1ms]
  → sensor_aggregator_get()
    ├─ mutex_lock()
    ├─ memcpy(cache)
    └─ mutex_unlock()
  → Returns sensor_readings
  → network_send_coap()
```

---

## 📁 Complete File Structure

```
firmware/sensor-node/
├── src/
│   ├── main.c                    # Main loop (60s warmup, 30s cycle)
│   ├── network.c                 # CoAP/CBOR/Thread networking
│   ├── network.h
│   ├── storage.c                 # NVS offline queue (50 packets)
│   ├── storage.h
│   └── sensors/
│       ├── sensor_interface.h    # Common API (both modes)
│       ├── sensor_sim.c          # Simulation: 12s blocking reads
│       ├── sensor_hw.c           # Hardware: <1ms cache reads
│       ├── sensor_aggregator.c   # 3 polling threads + cache
│       ├── sensor_aggregator.h
│       └── drivers/
│           ├── scd41_driver.c    # Wraps Zephyr SCD4X driver
│           ├── scd41_driver.h
│           ├── ccs811_driver.c   # Wraps Zephyr CCS811 driver
│           ├── ccs811_driver.h
│           ├── sps30_driver.c    # Wraps Zephyr SPS30 driver
│           └── sps30_driver.h
├── Kconfig                       # Mode selection
├── CMakeLists.txt                # Conditional compilation
├── prj.conf                      # Base config (both modes)
├── prj_hw.conf                   # Hardware additions (I2C, drivers)
├── app.overlay                   # I2C pins + sensor nodes
└── README.md
```

---

## 🔌 Sensor Interface API

### Core Structure

```c
struct sensor_readings {
    float    temperature;   // °C (SCD41)
    float    humidity;      // %RH (SCD41)
    float    co2;          // ppm (SCD41)
    float    tvoc;         // ppb (CCS811)
    float    eco2;         // ppm (CCS811)
    float    pm1;          // µg/m³ (SPS30)
    float    pm25;         // µg/m³ (SPS30)
    float    pm4;          // µg/m³ (SPS30)
    float    pm10;         // µg/m³ (SPS30)
    float    light;        // lux (simulated/constant)
    uint8_t  health_mask;  // 4-bit status
};
```

### Health Mask

```c
Bit 0: SENSOR_HEALTH_TEMP_HUM  (SCD41 Temp/Hum)
Bit 1: SENSOR_HEALTH_CO2       (SCD41 CO₂)
Bit 2: SENSOR_HEALTH_PM        (SPS30 PM)
Bit 3: SENSOR_HEALTH_TVOC      (CCS811 TVOC/eCO₂)

0x0F = All sensors OK
0x00 = All sensors FAULT
```

### API Functions

```c
int sensor_backend_init(struct sensor_context **ctx);
int sensor_backend_read(struct sensor_context *ctx, 
                       struct sensor_readings *out);
void sensor_backend_deinit(struct sensor_context *ctx);
```

---

## 🎭 Simulation Mode Details

**File**: `sensor_sim.c`

### Features

1. **Random Walk Baselines** - Slow drift over time
2. **Trend Events** - CO₂ or PM2.5 spikes (1% chance per cycle)
3. **Failure Injection** - 15% per-sensor failure rate
4. **Realistic Latencies** - Total 12 seconds blocking

### Latency Breakdown

| Sensor | Latency | Failure Rate |
|--------|---------|--------------|
| Temp/Hum | 100ms | 15% |
| CO₂ | 10,000ms | 15% |
| PM | 1,000ms | 15% |
| TVOC | 1,000ms | 15% |
| **Total** | **~12s** | - |

### Trend Events

**CO₂ Spike**:
- Duration: 30-90 cycles
- Slope: +5 to +20 ppm/cycle
- Triggers: 1% chance per read

**PM2.5 Spike**:
- Duration: 30-90 cycles
- Slope: +0.2 to +1.0 µg/m³/cycle
- Triggers: 1% chance per read

---

## 🔧 Hardware Mode Details

**Files**: `sensor_hw.c` + `sensor_aggregator.c` + drivers

### Architecture: Multi-Threaded Aggregator

```
┌──────────────────────────────────────────────────┐
│           SENSOR AGGREGATOR                       │
├──────────────────────────────────────────────────┤
│                                                   │
│  Thread 1: scd41_poll  (Priority 7, 5.5s sleep)  │
│  Thread 2: ccs811_poll (Priority 7, 1.0s sleep)  │
│  Thread 3: sps30_poll  (Priority 7, 1.5s sleep)  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         Shared Cache (mutex-protected)      │ │
│  │  • sensor_readings struct                   │ │
│  │  • Updated by polling threads               │ │
│  │  • Read by main thread (non-blocking)       │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Polling Threads

**SCD41 Thread**:
- Interval: 5.5 seconds
- Reads: CO₂, Temperature, Humidity
- Updates: 3 fields + 2 health bits

**CCS811 Thread**:
- Interval: 1.0 second
- Reads: eCO₂, TVOC
- Warm-up: 20 minutes (configurable)
- Updates: 2 fields + 1 health bit

**SPS30 Thread**:
- Interval: 1.5 seconds
- Reads: PM1.0, PM2.5, PM4.0, PM10
- Fan cleaning: 10s every 168h (holds last value)
- Updates: 4 fields + 1 health bit

### Cache Read (Non-Blocking)

```c
void sensor_aggregator_get(struct sensor_readings *out)
{
    k_mutex_lock(&cache_mutex, K_FOREVER);
    memcpy(out, &cache, sizeof(struct sensor_readings));
    k_mutex_unlock(&cache_mutex);
    // Returns in <1ms
}
```

---

## 🌡️ Hardware Sensors

### SCD41 (CO₂, Temperature, Humidity)

- **I2C Address**: 0x62
- **Measurement Time**: 5 seconds
- **Range**: 400-5000 ppm CO₂, -10 to +60°C, 0-100% RH
- **Accuracy**: ±40 ppm, ±0.8°C, ±6% RH

### CCS811 (eCO₂, TVOC)

- **I2C Address**: 0x5A or 0x5B
- **Measurement Time**: 1 second
- **Range**: 400-8192 ppm eCO₂, 0-1187 ppb TVOC
- **Warm-up**: 20 minutes per power cycle

### SPS30 (Particulate Matter)

- **I2C Address**: 0x69
- **Measurement Time**: 1 second
- **Range**: 0-1000 µg/m³ (PM1.0, PM2.5, PM4.0, PM10)
- **Fan Cleaning**: 10 seconds every 168 hours

---

## 🌐 Network Layer

**File**: `network.c`

### CBOR Payload

```
Array of 16 elements (~88 bytes):
[
  "node-598c",    // Node ID (MAC-derived)
  "a3f2b1c0",     // Boot ID (random)
  42,             // Sequence number
  123456,         // Uptime (ms)
  22.5,           // Temperature
  45.2,           // Humidity
  650.0,          // CO₂
  25.3,           // TVOC
  475.0,          // eCO₂
  2.1,            // PM1.0
  5.3,            // PM2.5
  6.4,            // PM4.0
  8.0,            // PM10
  500.0,          // Light
  15,             // Health mask (0x0F)
  "node-598c"     // Mesh ID
]
```

### CoAP Transmission

- **Protocol**: CoAP over UDP over Thread
- **Gateway**: fd5e:a726:ec55:ee12::1:5683
- **ACK Timeout**: 5 seconds
- **Retry**: 3 failures → Thread stack reset

---

## 💾 Storage Layer

**File**: `storage.c`

### NVS Offline Queue

- **Capacity**: 50 packets
- **Persistence**: Survives power cycles
- **Draining**: 5 packets per successful transmission
- **Usage**: Logged every cycle

---

## ⚙️ Build System

### Mode Selection

```bash
# Simulation Mode (default)
west build -p always -b nrf52840dk/nrf52840

# Hardware Mode
west build -p always -b nrf52840dk/nrf52840 -- \
  -DCONFIG_SENSOR_MODE_HARDWARE=y \
  -DEXTRA_CONF_FILE=prj_hw.conf
```

### Conditional Compilation

**CMakeLists.txt**:
```cmake
# Simulation backend
target_sources_ifdef(CONFIG_SENSOR_MODE_SIMULATION app PRIVATE
    src/sensors/sensor_sim.c
)

# Hardware backend + drivers
target_sources_ifdef(CONFIG_SENSOR_MODE_HARDWARE app PRIVATE
    src/sensors/sensor_hw.c
    src/sensors/sensor_aggregator.c
    src/sensors/drivers/scd41_driver.c
    src/sensors/drivers/ccs811_driver.c
    src/sensors/drivers/sps30_driver.c
)
```

---

## 🛡️ Error Handling

### Sensor Failures

**Detection**:
- I2C timeout
- Invalid readings
- Driver init failure

**Response**:
- Set reading to `-999.0` (SENSOR_FAULT_VALUE)
- Clear health bit
- Log error
- Continue with remaining sensors

### Network Failures

**Detection**:
- CoAP ACK timeout
- Socket error
- Thread network down

**Response**:
1. Save packet to NVS
2. Increment failure counter
3. After 3 failures: reset Thread stack
4. On recovery: drain queue (5 packets/cycle)

### Special States

**CCS811 Warm-up** (20 min):
- Reading: `-998.0` (SENSOR_WARMUP_VALUE)
- Health bit: Cleared
- Log: "warming up (N min remaining)"

**SPS30 Fan Cleaning** (10s):
- Reading: Last good value (held)
- Health bit: Preserved
- Flag: `fan_cleaning=true`

---

## 📊 Performance Metrics

### Simulation Mode

| Metric | Value |
|--------|-------|
| Read Time | ~12 seconds |
| CPU Usage | Low (sleeps) |
| Memory | ~200 bytes |
| Threads | 1 (main) |

### Hardware Mode

| Metric | Value |
|--------|-------|
| Read Time | <1 ms |
| CPU Usage | Low (threads sleep) |
| Memory | ~500 bytes |
| Threads | 4 (main + 3 sensors) |

### Network

| Metric | Value |
|--------|-------|
| Payload Size | ~88 bytes (CBOR) |
| Transmission | 50-200 ms |
| ACK Timeout | 5 seconds |
| Queue Capacity | 50 packets |

---

## 🔍 Key Log Messages

### Simulation Mode
```
[SIM] Sensor simulation backend initialised
[SIM] Baselines: temp=22.3°C  hum=45.2%  co2=650ppm
[SIM] CO2 spike trend started (45 ticks)
[SIM] Temp/Hum fault injected (health=0x0E)
```

### Hardware Mode
```
[HW] Hardware sensor backend initialised
[HW] SCD41 + CCS811 + SPS30 background threads running
SCD41 polling thread started
CCS811 polling thread started
SPS30 polling thread started
CCS811: warming up (18 min remaining)
SPS30: fan-clean in progress, health bit preserved
```

### Main Loop
```
System warming up... (45/60s)
Offline Queue: 3 / 50 packets | Health: 0x0F
Network transmission failed (2/3). Saving to NVS queue...
Draining backlog packet ID 42...
```

---

## ✅ Summary

The SSNS Sensor Node firmware successfully implements a dual-mode architecture that:

1. **Abstracts sensor acquisition** through a common interface
2. **Supports both simulation and hardware** via compile-time selection
3. **Uses multi-threading** for non-blocking hardware reads
4. **Handles failures gracefully** with health monitoring
5. **Provides offline resilience** through NVS queue
6. **Optimizes bandwidth** with CBOR encoding
7. **Maintains compatibility** with existing backend/dashboard

The architecture is production-ready, well-documented, and easily extensible for future sensor types or operational modes.

---

**Document End**