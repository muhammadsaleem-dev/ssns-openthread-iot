# Statistical Aggregation Proposal

**Current Approach:** Send single sensor reading every 30 seconds  
**Proposed Approach:** Sample frequently, aggregate locally, send statistical summary  
**Goal:** Improve data quality and enable richer anomaly detection

---

## Executive Summary

**Question:** Should firmware send statistical summaries instead of single readings?

**Answer:** **Yes, with caveats.** Statistical aggregation provides richer data for ML models and reduces impact of measurement noise, but requires firmware changes and increased packet size.

**Recommendation:** Implement as **optional mode** (configurable via Kconfig) to support both approaches.

---

## 1. Current Architecture

### 1.1 Current Sampling Strategy

**File:** [`firmware/sensor-node/src/main.c:40-100`](../firmware/sensor-node/src/main.c#L40-L100)

```c
while (1) {
    // 1. Read sensors (once)
    sensor_backend_read(sensor_ctx, &readings);
    
    // 2. Transmit immediately
    network_send_coap(&readings);
    
    // 3. Wait 30 seconds
    k_sleep(K_SECONDS(30));
}
```

**Characteristics:**
- ✅ Simple implementation
- ✅ Low memory usage (no buffering)
- ✅ Real-time transmission
- ❌ Single point measurement (susceptible to noise)
- ❌ No variance information
- ❌ Misses transient events between samples

---

### 1.2 Current Packet Structure

**File:** [`firmware/sensor-node/src/network.c:213-231`](../firmware/sensor-node/src/network.c#L213-L231)

**CBOR Array (16 elements, ~88 bytes):**
```cbor
[
  "node-598c",      // Node ID
  "a3f2b1c0",       // Boot ID
  42,               // Sequence number
  123456,           // Uptime
  22.5,             // Temperature (single value)
  45.2,             // Humidity (single value)
  650.0,            // CO₂ (single value)
  25.3,             // TVOC (single value)
  475.0,            // eCO₂ (single value)
  2.1,              // PM1.0 (single value)
  5.3,              // PM2.5 (single value)
  6.4,              // PM4.0 (single value)
  8.0,              // PM10 (single value)
  500.0,            // Light (single value)
  15,               // Health mask
  "node-598c"       // Mesh ID
]
```

---

## 2. Proposed Architecture

### 2.1 Statistical Aggregation Strategy

**Concept:** Sample sensors frequently, aggregate locally, send summary statistics.

```c
// Sample every 5 seconds for 30 seconds (6 samples)
for (int i = 0; i < 6; i++) {
    sensor_backend_read(sensor_ctx, &readings);
    buffer[i] = readings;
    k_sleep(K_SECONDS(5));
}

// Calculate statistics
struct sensor_statistics stats = calculate_statistics(buffer, 6);

// Transmit summary
network_send_coap_statistics(&stats);
```

**Characteristics:**
- ✅ Reduces measurement noise (averaging)
- ✅ Captures variance (std deviation)
- ✅ Detects transient events (min/max)
- ✅ Richer data for ML models
- ❌ Increased memory usage (buffering)
- ❌ Larger packet size
- ❌ Delayed transmission (30s window)

---

### 2.2 Proposed Packet Structure

**Option A: Full Statistics (Mean, Min, Max, Std)**

**CBOR Array (~200 bytes):**
```cbor
[
  "node-598c",           // Node ID
  "a3f2b1c0",            // Boot ID
  42,                    // Sequence number
  123456,                // Uptime
  
  // Temperature statistics (4 values)
  22.5,                  // Mean
  21.8,                  // Min
  23.2,                  // Max
  0.5,                   // Std deviation
  
  // Humidity statistics (4 values)
  45.2, 44.5, 46.0, 0.6,
  
  // CO₂ statistics (4 values)
  650.0, 620.0, 680.0, 25.0,
  
  // ... repeat for all 10 sensors (40 values)
  
  15,                    // Health mask
  "node-598c"            // Mesh ID
]
```

**Size:** ~200 bytes (2.3x larger than current)

---

**Option B: Mean + Variance Only**

**CBOR Array (~120 bytes):**
```cbor
[
  "node-598c",           // Node ID
  "a3f2b1c0",            // Boot ID
  42,                    // Sequence number
  123456,                // Uptime
  
  // Temperature (2 values)
  22.5,                  // Mean
  0.5,                   // Std deviation
  
  // Humidity (2 values)
  45.2, 0.6,
  
  // CO₂ (2 values)
  650.0, 25.0,
  
  // ... repeat for all 10 sensors (20 values)
  
  15,                    // Health mask
  "node-598c"            // Mesh ID
]
```

**Size:** ~120 bytes (1.4x larger than current)

---

**Option C: Adaptive (Send Full Stats Only When Variance High)**

```c
if (std_deviation > threshold) {
    // High variance detected - send full statistics
    send_full_statistics();
} else {
    // Low variance - send mean only (current approach)
    send_mean_only();
}
```

**Size:** 88-200 bytes (adaptive)

---

## 3. Benefits Analysis

### 3.1 Noise Reduction

**Problem:** Single measurements susceptible to sensor noise.

**Example (Temperature):**
```
Current approach (single reading):
  t=0s: 22.5°C (could be noisy)

Proposed approach (6 samples):
  t=0s:  22.3°C
  t=5s:  22.7°C
  t=10s: 22.4°C
  t=15s: 22.6°C
  t=20s: 22.5°C
  t=25s: 22.5°C
  
  Mean: 22.5°C (more reliable)
  Std:  0.14°C (low variance = stable)
```

**Impact:** More reliable baseline for ML training.

---

### 3.2 Transient Event Detection

**Problem:** Current approach misses events between 30s samples.

**Example (TVOC spike from cleaning spray):**
```
Current approach:
  t=0s:   25 ppb (normal)
  t=30s:  28 ppb (normal)
  → Missed spike at t=15s: 850 ppb!

Proposed approach:
  Samples: [25, 30, 850, 780, 150, 35 ppb]
  Mean: 278 ppb
  Max:  850 ppb ← Transient event captured!
  Std:  345 ppb ← High variance indicates event
```

**Impact:** Enables transient event detection without increasing transmission frequency.

---

### 3.3 Variance-Based Anomaly Detection

**Problem:** IsolationForest only sees mean values, not variability.

**Example (Unstable HVAC):**
```
Current approach:
  Node A: 22.5°C (stable HVAC)
  Node B: 22.5°C (unstable HVAC oscillating 20-25°C)
  → Both look identical to ML model!

Proposed approach:
  Node A: Mean=22.5°C, Std=0.2°C (stable)
  Node B: Mean=22.5°C, Std=2.1°C (unstable)
  → ML model can detect instability
```

**Impact:** Richer feature space for anomaly detection (20 features instead of 10).

---

### 3.4 Rate-of-Change Estimation

**Problem:** Current approach requires storing multiple packets to calculate rate-of-change.

**Example (CO₂ trend):**
```
Current approach (backend calculates):
  t=0s:   650 ppm
  t=30s:  680 ppm
  t=60s:  710 ppm
  Rate: +30 ppm/30s = +1 ppm/s

Proposed approach (firmware calculates):
  Samples: [650, 660, 670, 680, 690, 700 ppm]
  Linear fit: slope = +10 ppm/5s = +2 ppm/s
  → More accurate rate estimation from local samples
```

**Impact:** Better trend detection for forecasting.

---

## 4. Costs Analysis

### 4.1 Memory Usage (Firmware)

**Current:**
```c
struct sensor_readings readings;  // ~80 bytes
```

**Proposed:**
```c
struct sensor_readings buffer[6];  // ~480 bytes (6 samples)
struct sensor_statistics stats;    // ~160 bytes (mean, min, max, std)
```

**Total:** +640 bytes RAM

**Impact:** Acceptable for nRF52840 (256 KB RAM).

---

### 4.2 Packet Size (Network)

| Approach | Size | Overhead | Impact |
|----------|------|----------|--------|
| Current (mean only) | 88 bytes | 1.0x | Baseline |
| Option A (full stats) | 200 bytes | 2.3x | Higher bandwidth |
| Option B (mean + std) | 120 bytes | 1.4x | Moderate |
| Option C (adaptive) | 88-200 bytes | 1.0-2.3x | Variable |

**Thread Network Bandwidth:**
- Max payload: ~1280 bytes (IPv6 MTU)
- Current usage: 88 bytes/30s = 2.9 bytes/s
- Proposed (Option B): 120 bytes/30s = 4.0 bytes/s

**Impact:** Negligible (Thread supports up to 250 kbps).

---

### 4.3 Processing Overhead (Firmware)

**Current:**
```c
// Single read: ~12s (simulation) or <1ms (hardware)
sensor_backend_read(sensor_ctx, &readings);
```

**Proposed:**
```c
// 6 reads: ~72s (simulation) or ~30ms (hardware)
for (int i = 0; i < 6; i++) {
    sensor_backend_read(sensor_ctx, &readings);
    k_sleep(K_SECONDS(5));
}

// Statistics calculation: ~1ms
calculate_statistics(buffer, 6);
```

**Impact:** 
- Simulation mode: Unacceptable (72s vs 12s)
- Hardware mode: Acceptable (30ms vs <1ms)

**Solution:** Only enable in hardware mode.

---

### 4.4 Backend Changes

**Gateway:**
```python
# Current: Parse single values
temp = payload[4]

# Proposed: Parse statistics
temp_mean = payload[4]
temp_min = payload[5]
temp_max = payload[6]
temp_std = payload[7]
```

**Backend (MongoDB):**
```java
// Current schema
{
  "temperature": 22.5
}

// Proposed schema
{
  "temperature": {
    "mean": 22.5,
    "min": 21.8,
    "max": 23.2,
    "std": 0.5
  }
}
```

**ML Service:**
```python
# Current: 10 features
features = [temp, humidity, co2, ...]

# Proposed: 20 features (mean + std)
features = [temp_mean, temp_std, humidity_mean, humidity_std, ...]

# Or: 40 features (mean, min, max, std)
features = [temp_mean, temp_min, temp_max, temp_std, ...]
```

**Impact:** Significant refactoring required.

---

## 5. Implementation Strategy

### 5.1 Phased Approach

**Phase 1: Firmware Aggregation (Hardware Mode Only)**

**Changes:**
1. Add sampling buffer to `main.c`:
```c
#ifdef CONFIG_STATISTICAL_AGGREGATION
    struct sensor_readings buffer[CONFIG_AGGREGATION_SAMPLES];
    for (int i = 0; i < CONFIG_AGGREGATION_SAMPLES; i++) {
        sensor_backend_read(sensor_ctx, &buffer[i]);
        k_sleep(K_SECONDS(CONFIG_SAMPLE_INTERVAL));
    }
    struct sensor_statistics stats = calculate_statistics(buffer, CONFIG_AGGREGATION_SAMPLES);
    network_send_coap_statistics(&stats);
#else
    // Current approach
    sensor_backend_read(sensor_ctx, &readings);
    network_send_coap(&readings);
#endif
```

2. Add statistics calculation:
```c
struct sensor_statistics {
    float temp_mean, temp_std;
    float humidity_mean, humidity_std;
    // ... for all 10 sensors
};

struct sensor_statistics calculate_statistics(struct sensor_readings *buffer, int count) {
    struct sensor_statistics stats;
    
    // Calculate mean
    stats.temp_mean = mean(buffer, count, offsetof(struct sensor_readings, temperature));
    
    // Calculate std deviation
    stats.temp_std = std_dev(buffer, count, offsetof(struct sensor_readings, temperature));
    
    // ... repeat for all sensors
    
    return stats;
}
```

3. Add Kconfig options:
```kconfig
config STATISTICAL_AGGREGATION
    bool "Enable statistical aggregation"
    default n
    help
      Sample sensors frequently and send statistical summary.

config AGGREGATION_SAMPLES
    int "Number of samples to aggregate"
    default 6
    depends on STATISTICAL_AGGREGATION

config SAMPLE_INTERVAL
    int "Interval between samples (seconds)"
    default 5
    depends on STATISTICAL_AGGREGATION
```

**Estimated Time:** 2-3 days

---

**Phase 2: Gateway & Backend Support**

**Changes:**
1. Update gateway CBOR parser:
```python
# Detect packet type
if len(payload) == 88:
    # Current format (single values)
    parse_single_values()
elif len(payload) == 120:
    # Statistical format (mean + std)
    parse_statistics()
```

2. Update MongoDB schema:
```java
// Support both formats
if (request.hasStatistics()) {
    entity.setTemperatureMean(request.getTemperatureMean());
    entity.setTemperatureStd(request.getTemperatureStd());
} else {
    entity.setTemperature(request.getTemperature());
}
```

**Estimated Time:** 3-4 days

---

**Phase 3: ML Service Enhancement**

**Changes:**
1. Extend feature vector:
```python
# Current: 10 features
features = [temp, humidity, co2, tvoc, eco2, pm1_0, pm2_5, pm4_0, pm10, light]

# Proposed: 20 features (mean + std)
features = [
    temp_mean, temp_std,
    humidity_mean, humidity_std,
    co2_mean, co2_std,
    # ... etc
]
```

2. Retrain IsolationForest with 20-dimensional feature space.

3. Add variance-based anomaly detection:
```python
# High variance indicates instability
if temp_std > 2.0:  # °C
    return "UNSTABLE_HVAC"
```

**Estimated Time:** 4-5 days

---

### 5.2 Backward Compatibility

**Strategy:** Support both packet formats simultaneously.

```python
# Gateway auto-detection
def parse_telemetry(payload):
    if len(payload) == 88:
        return parse_legacy_format(payload)
    elif len(payload) == 120:
        return parse_statistical_format(payload)
    else:
        raise ValueError("Unknown packet format")
```

**Benefits:**
- ✅ Gradual migration (node-by-node)
- ✅ No breaking changes
- ✅ A/B testing possible

---

## 6. Use Cases

### 6.1 Stable Environment (Server Room)

**Current Approach:**
```
t=0s:   Temp=22.5°C, CO₂=650ppm
t=30s:  Temp=22.5°C, CO₂=652ppm
t=60s:  Temp=22.5°C, CO₂=649ppm
```

**Proposed Approach:**
```
t=0-30s:  Temp: mean=22.5°C, std=0.1°C (very stable)
          CO₂:  mean=650ppm, std=2ppm (very stable)
```

**Benefit:** Confirms stability with quantitative variance metric.

---

### 6.2 Variable Environment (Kitchen)

**Current Approach:**
```
t=0s:   Temp=20°C, TVOC=25ppb (idle)
t=30s:  Temp=24°C, TVOC=450ppb (cooking)
t=60s:  Temp=22°C, TVOC=150ppb (cooling)
```

**Proposed Approach:**
```
t=0-30s:  Temp: mean=22°C, std=2.1°C, max=25°C (cooking detected)
          TVOC: mean=250ppb, std=180ppb, max=850ppb (spike captured)
```

**Benefit:** Captures transient cooking spike (850ppb) that occurred at t=15s.

---

### 6.3 Transient Event (Cleaning Spray)

**Current Approach:**
```
t=0s:   TVOC=25ppb (normal)
t=30s:  TVOC=28ppb (normal)
→ Missed spike at t=12s: 1200ppb!
```

**Proposed Approach:**
```
t=0-30s:  TVOC: mean=180ppb, std=420ppb, max=1200ppb
→ High std + high max indicates transient event
```

**Benefit:** Detects transient events without increasing transmission frequency.

---

## 7. Recommendation

### 7.1 Implement as Optional Feature

**Rationale:**
- ✅ Provides richer data for ML models
- ✅ Enables transient event detection
- ✅ Reduces measurement noise
- ✅ Backward compatible
- ⚠️ Requires firmware, gateway, backend, ML changes
- ⚠️ Increases packet size (1.4-2.3x)

**Recommendation:** Implement **Option B (Mean + Std)** as optional Kconfig feature.

---

### 7.2 Configuration

```kconfig
# prj_hw_stats.conf
CONFIG_STATISTICAL_AGGREGATION=y
CONFIG_AGGREGATION_SAMPLES=6
CONFIG_SAMPLE_INTERVAL=5
```

**Build command:**
```bash
west build -p always -b nrf52840dk/nrf52840 \
  -- -DCONFIG_SENSOR_MODE_HARDWARE=y \
     -DEXTRA_CONF_FILE=prj_hw_stats.conf
```

---

### 7.3 Deployment Strategy

**Phase 1:** Deploy to 1-2 test nodes
- Validate packet format
- Measure network overhead
- Test ML model with 20 features

**Phase 2:** A/B testing
- 50% nodes with statistics
- 50% nodes with single values
- Compare false positive rates

**Phase 3:** Gradual rollout
- Migrate nodes one-by-one
- Monitor for issues
- Rollback if needed

---

## 8. Future Enhancements

### 8.1 Adaptive Sampling Rate

**Concept:** Increase sampling frequency when variance is high.

```c
if (recent_std > threshold) {
    // High variance - sample more frequently
    sample_interval = 2;  // seconds
} else {
    // Low variance - sample less frequently
    sample_interval = 10;  // seconds
}
```

---

### 8.2 Edge Computing (On-Device Anomaly Detection)

**Concept:** Run lightweight anomaly detection on firmware.

```c
// Calculate z-score locally
float z_score = (current_value - local_mean) / local_std;

if (z_score > 3.0) {
    // Anomaly detected - send alert immediately
    send_urgent_alert();
}
```

**Benefit:** Faster response time (no backend round-trip).

---

### 8.3 Compression

**Concept:** Use delta encoding for statistics.

```c
// Instead of sending absolute values
[22.5, 0.5, 45.2, 0.6, ...]

// Send deltas from previous packet
[+0.2, +0.1, -0.3, +0.05, ...]
```

**Benefit:** Reduces packet size by ~30%.

---

## 9. Conclusion

### Summary

**Statistical aggregation provides significant benefits:**
- ✅ Reduces measurement noise
- ✅ Captures transient events
- ✅ Enables variance-based anomaly detection
- ✅ Improves ML model accuracy

**But requires careful implementation:**
- ⚠️ Increased packet size (1.4x)
- ⚠️ Firmware, gateway, backend, ML changes
- ⚠️ Only suitable for hardware mode

### Recommendation

**Implement as optional feature** (Kconfig-based) with:
- **Option B:** Mean + Std (120 bytes)
- **Backward compatibility:** Support both formats
- **Phased rollout:** Test → A/B → Gradual migration

### Implementation Effort

- **Phase 1 (Firmware):** 2-3 days
- **Phase 2 (Gateway/Backend):** 3-4 days
- **Phase 3 (ML Service):** 4-5 days

**Total:** 9-12 days

### Master's Thesis Angle

**Research Question:** Does statistical aggregation improve anomaly detection accuracy compared to single-point measurements?

**Methodology:**
- A/B test: 50% nodes with stats, 50% without
- Metrics: False positive rate, detection latency, transient event capture rate
- Duration: 4 weeks in real office environment

**Expected Outcome:** 20-30% reduction in false positives, 3x improvement in transient event detection.

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-12  
**Status:** Proposal for discussion