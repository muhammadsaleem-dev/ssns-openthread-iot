# Statistical Aggregation Proposal V2 (Hardware-Aware)

**Version:** 2.0 (Hardware-Aware Revision)  
**Date:** 2026-06-12  
**Status:** Production-grade proposal for Master's thesis

---

## Executive Summary

**Question:** Should firmware send statistical summaries instead of single readings?

**Answer:** **Yes, but with sensor-specific sampling strategies.** Each sensor has different update rates and characteristics that must be respected.

**Key Insight:** The current architecture already implements **continuous background sampling** via independent threads. We can leverage this to compute statistics without changing the sampling strategy.

**Recommendation:** Compute statistics from the **existing thread samples** rather than introducing new sampling logic.

---

## 1. Current Architecture (Hardware Mode)

### 1.1 Multi-Threaded Sensor Aggregator

**File:** [`sensor_aggregator.c:1-301`](../firmware/sensor-node/src/sensors/sensor_aggregator.c)

**Architecture:**
```
┌────────────────┐  ┌─────────────────┐  ┌────────────────┐
│  scd41_poll    │  │  ccs811_poll    │  │  sps30_poll    │
│  (5.5 s sleep) │  │  (1.0 s sleep)  │  │  (1.5 s sleep) │
│  Priority: 7   │  │  Priority: 7    │  │  Priority: 7   │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │   cache + mutex      │  ← k_mutex
                  └──────────┬──────────┘
                             │
                  sensor_aggregator_get()   ← non-blocking copy
                             │
                  sensor_backend_read()   (sensor_hw.c)
```

**Key Properties:**
- ✅ **Already sampling continuously** in background
- ✅ **Non-blocking reads** (<1ms cache copy)
- ✅ **Independent thread per sensor** (different update rates)
- ✅ **Mutex-protected cache** (thread-safe)

---

### 1.2 Actual Hardware Sensor Specifications

#### SCD41 (Temperature, Humidity, CO₂)

**Datasheet:** Sensirion SCD41  
**File:** [`scd41_driver.h:36-37`](../firmware/sensor-node/src/sensors/drivers/scd41_driver.h#L36-L37)

```c
// Note: the SCD41 background measurement runs at 5 s intervals; calling this
// more frequently than 5 s will return the same cached measurement.
```

**Specifications:**
- **Internal update rate:** 5 seconds (fixed by hardware)
- **Thread polling rate:** 5.5 seconds (lines 94-96)
- **Measurement latency:** ~5ms I2C transaction
- **Warm-up:** None (ready immediately)

**Conclusion:** Sampling faster than 5 seconds is **pointless** - sensor returns cached value.

---

#### CCS811 (TVOC, eCO₂)

**Datasheet:** AMS CCS811  
**File:** [`ccs811_driver.h:20-25`](../firmware/sensor-node/src/sensors/drivers/ccs811_driver.h#L20-L25)

```c
// 2. Warm-up requirement:
//    The CCS811 metal-oxide sensor needs 20 MINUTES after power-on
//    before readings are stable and reliable. Brand-new sensors need
//    a 48-hour burn-in on first use.
```

**Specifications:**
- **Internal update rate:** 1 second (configurable: 1s, 10s, 60s modes)
- **Thread polling rate:** 1 second (line 140)
- **Measurement latency:** ~10ms I2C transaction
- **Warm-up:** 20 minutes (readings invalid before this)

**Conclusion:** Can sample every 1 second for **rapid VOC spike detection**.

---

#### SPS30 (PM1.0, PM2.5, PM4.0, PM10)

**Datasheet:** Sensirion SPS30  
**File:** [`sps30_driver.h:7-13`](../firmware/sensor-node/src/sensors/drivers/sps30_driver.h#L7-L13)

```c
// Fan-cleaning behaviour:
//   The SPS30 automatically runs a 10-second fan-cleaning cycle every 168 h.
//   During this window, no new PM data is produced.
```

**Specifications:**
- **Internal update rate:** 1 second (continuous measurement)
- **Thread polling rate:** 1.5 seconds (line 187)
- **Measurement latency:** ~15ms I2C transaction
- **Fan cleaning:** 10-second blackout every 168 hours

**Conclusion:** Can sample every 1-2 seconds for **particulate trend detection**.

---

#### Light Sensor

**File:** [`sensor_aggregator.c:213`](../firmware/sensor-node/src/sensors/sensor_aggregator.c#L213)

```c
cache.light = 500.0f;   /* Constant indoor fallback (no light sensor) */
```

**Specifications:**
- **Status:** Not implemented (constant value)
- **Future:** Could use analog photoresistor (100ms sampling)

**Conclusion:** Currently irrelevant for statistical aggregation.

---

## 2. Hardware-Aware Sampling Strategy

### 2.1 Per-Sensor Optimal Sampling Rates

| Sensor | Hardware Update Rate | Thread Poll Rate | Samples per 30s | Rationale |
|--------|---------------------|------------------|-----------------|-----------|
| **SCD41** | 5.0s (fixed) | 5.5s | **5-6 samples** | Hardware limit - can't sample faster |
| **CCS811** | 1.0s (configurable) | 1.0s | **30 samples** | Rapid VOC changes - sample frequently |
| **SPS30** | 1.0s (continuous) | 1.5s | **20 samples** | PM trends - moderate sampling |
| **Light** | N/A | N/A | **1 sample** | Constant value (no sensor) |

**Key Insight:** Different sensors have **fundamentally different** update rates. Uniform 5-second sampling is suboptimal.

---

### 2.2 Proposed Architecture: Per-Sensor Statistics Buffers

**Concept:** Each polling thread maintains its own circular buffer and computes statistics locally.

```c
// sensor_aggregator.c

// Per-sensor circular buffers
#define SCD41_BUFFER_SIZE  6   // 5.5s × 6 = 33s window
#define CCS811_BUFFER_SIZE 30  // 1.0s × 30 = 30s window
#define SPS30_BUFFER_SIZE  20  // 1.5s × 20 = 30s window

struct scd41_buffer {
    float temp[SCD41_BUFFER_SIZE];
    float humidity[SCD41_BUFFER_SIZE];
    float co2[SCD41_BUFFER_SIZE];
    int write_idx;
    int count;
};

struct ccs811_buffer {
    float tvoc[CCS811_BUFFER_SIZE];
    float eco2[CCS811_BUFFER_SIZE];
    int write_idx;
    int count;
};

struct sps30_buffer {
    float pm1[SPS30_BUFFER_SIZE];
    float pm25[SPS30_BUFFER_SIZE];
    float pm4[SPS30_BUFFER_SIZE];
    float pm10[SPS30_BUFFER_SIZE];
    int write_idx;
    int count;
};
```

**Benefits:**
- ✅ Respects hardware update rates
- ✅ No cross-sensor synchronization needed
- ✅ Each sensor optimized independently
- ✅ Minimal memory overhead (~500 bytes total)

---

### 2.3 Statistics Calculation

**Compute on-demand when main thread requests transmission:**

```c
struct sensor_statistics {
    // SCD41 (5-6 samples)
    float temp_mean, temp_std, temp_max;
    float humidity_mean, humidity_std, humidity_max;
    float co2_mean, co2_std, co2_max;
    
    // CCS811 (30 samples)
    float tvoc_mean, tvoc_std, tvoc_max;
    float eco2_mean, eco2_std, eco2_max;
    
    // SPS30 (20 samples)
    float pm1_mean, pm1_std, pm1_max;
    float pm25_mean, pm25_std, pm25_max;
    float pm4_mean, pm4_std, pm4_max;
    float pm10_mean, pm10_std, pm10_max;
    
    // Light (1 sample)
    float light;
    
    // Health mask
    uint8_t health_mask;
};

void sensor_aggregator_get_statistics(struct sensor_statistics *out) {
    k_mutex_lock(&cache_mutex, K_FOREVER);
    
    // Calculate SCD41 statistics (6 samples)
    out->temp_mean = mean(scd41_buf.temp, scd41_buf.count);
    out->temp_std = std_dev(scd41_buf.temp, scd41_buf.count);
    out->temp_max = max(scd41_buf.temp, scd41_buf.count);
    
    // Calculate CCS811 statistics (30 samples)
    out->tvoc_mean = mean(ccs811_buf.tvoc, ccs811_buf.count);
    out->tvoc_std = std_dev(ccs811_buf.tvoc, ccs811_buf.count);
    out->tvoc_max = max(ccs811_buf.tvoc, ccs811_buf.count);
    
    // ... similar for SPS30
    
    k_mutex_unlock(&cache_mutex);
}
```

---

## 3. Packet Structure Analysis

### 3.1 Option A: Mean + Std + Max (Recommended)

**Rationale:** MAX is critical for transient event detection (e.g., deodorant spray).

**CBOR Structure (~150 bytes):**
```cbor
[
  "node-598c",           // Node ID
  "a3f2b1c0",            // Boot ID
  42,                    // Sequence number
  123456,                // Uptime
  
  // SCD41 (3 values × 3 sensors = 9 values)
  22.5, 0.2, 23.1,       // Temp: mean, std, max
  45.2, 0.5, 46.0,       // Humidity: mean, std, max
  650.0, 15.0, 680.0,    // CO₂: mean, std, max
  
  // CCS811 (3 values × 2 sensors = 6 values)
  25.3, 5.2, 85.0,       // TVOC: mean, std, max
  475.0, 10.0, 520.0,    // eCO₂: mean, std, max
  
  // SPS30 (3 values × 4 sensors = 12 values)
  2.1, 0.3, 2.8,         // PM1.0: mean, std, max
  5.3, 0.8, 7.2,         // PM2.5: mean, std, max
  6.4, 1.0, 8.5,         // PM4.0: mean, std, max
  8.0, 1.2, 10.5,        // PM10: mean, std, max
  
  500.0,                 // Light (single value)
  15,                    // Health mask
  "node-598c"            // Mesh ID
]
```

**Total:** 16 + 27 + 2 = **45 values** (~150 bytes)

**Comparison:**
- Current: 16 values (~88 bytes)
- Proposed: 45 values (~150 bytes)
- **Overhead: 1.7x** (acceptable)

---

### 3.2 Why MAX is Essential

**Scenario: Transient VOC Spike (Cleaning Spray)**

**Without MAX:**
```
CCS811 samples over 30 seconds:
[25, 28, 30, 1200, 950, 150, 35, 30, 28, 25, ...]

Mean: 180 ppb (diluted by normal readings)
Std:  320 ppb (high variance detected)

Problem: Peak value (1200 ppb) is lost!
```

**With MAX:**
```
Mean: 180 ppb
Std:  320 ppb
Max:  1200 ppb ← Transient spike captured!

Detection: High std + high max = TRANSIENT_VOC_EVENT
```

**Conclusion:** MAX is **critical** for transient event classification.

---

### 3.3 Why MIN is Not Needed

**Rationale:**
- Indoor environments rarely have "transient lows" (no negative spikes)
- MIN provides little actionable information
- Saves 10 values (~30 bytes)

**Exception:** Temperature MIN could detect HVAC failure (sudden cold), but MAX is more critical (overheating).

---

## 4. Transmission Interval Analysis

### 4.1 Current: 30-Second Transmission

**Pros:**
- ✅ Real-time dashboard updates
- ✅ Fast anomaly detection (<30s latency)
- ✅ Acceptable network overhead (2.9 bytes/s)

**Cons:**
- ❌ Limited statistical window (only 5-6 SCD41 samples)
- ❌ Frequent transmissions (battery impact if wireless)

---

### 4.2 Alternative: 60-Second Transmission

**Pros:**
- ✅ Larger statistical window (10-12 SCD41 samples, 60 CCS811 samples)
- ✅ Better noise reduction (more samples)
- ✅ Reduced network overhead (1.5 bytes/s)

**Cons:**
- ❌ Slower anomaly detection (60s latency)
- ❌ Dashboard updates less responsive

---

### 4.3 Recommendation: Keep 30-Second Transmission

**Rationale:**
1. **Real-time alerting requirement:** 60s latency is too slow for critical alerts (e.g., CO₂ > 1500 ppm)
2. **Dashboard responsiveness:** Users expect <30s updates
3. **Network overhead acceptable:** Thread mesh supports 250 kbps, we use <0.01%
4. **Statistical validity:** Even 5-6 samples provide meaningful statistics

**Evidence from current architecture:**
- ML service polls every 10 seconds (line 36 in `poller.py`)
- Forecaster uses 60-sample window (60 minutes at 1-minute intervals)
- 30-second transmission aligns with real-time monitoring expectations

---

## 5. ML Architecture Impact

### 5.1 Feature Vector Dimensionality

**Current:** 10 features (mean values only)
```python
features = [temp, humidity, co2, tvoc, eco2, pm1_0, pm2_5, pm4_0, pm10, light]
```

**Proposed Option A:** 30 features (mean + std + max)
```python
features = [
    temp_mean, temp_std, temp_max,
    humidity_mean, humidity_std, humidity_max,
    co2_mean, co2_std, co2_max,
    tvoc_mean, tvoc_std, tvoc_max,
    eco2_mean, eco2_std, eco2_max,
    pm1_0_mean, pm1_0_std, pm1_0_max,
    pm2_5_mean, pm2_5_std, pm2_5_max,
    pm4_0_mean, pm4_0_std, pm4_0_max,
    pm10_mean, pm10_std, pm10_max,
    light
]
```

**Proposed Option B:** 20 features (mean + std only)
```python
features = [
    temp_mean, temp_std,
    humidity_mean, humidity_std,
    # ... etc
]
```

---

### 5.2 IsolationForest Dimensionality Concern

**Problem:** Increasing from 10 → 30 dimensions may cause:
- **Curse of dimensionality:** Model requires more training data
- **Overfitting:** 20-sample baseline may be insufficient
- **Computational cost:** 3x more features = slower inference

**Analysis:**

**Current baseline:** 20 samples × 10 features = **200 data points**

**Proposed (30 features):** 20 samples × 30 features = **600 data points**

**IsolationForest rule of thumb:** Need ~10 samples per feature
- 10 features → 100 samples (current: 20 samples = **insufficient**)
- 30 features → 300 samples (would need 300 samples = **very insufficient**)

**Conclusion:** Jumping to 30 features immediately is **risky**.

---

### 5.3 Recommended Approach: Hybrid Strategy

**Phase 1: Use Std as Rule-Based Signal (Not ML Feature)**

```python
# Don't add std to IsolationForest feature vector
# Use std separately for rule-based detection

if tvoc_std > 100 and tvoc_max > 500:
    return "TRANSIENT_VOC_EVENT"

if temp_std > 2.0:
    return "UNSTABLE_HVAC"

if pm25_std > 10.0:
    return "VARIABLE_PARTICULATE_SOURCE"
```

**Benefits:**
- ✅ No ML retraining required
- ✅ Interpretable rules
- ✅ Immediate deployment
- ✅ Complements IsolationForest (hybrid approach)

---

**Phase 2: Gradual ML Feature Expansion**

**Step 1:** Add only MAX values (10 → 20 features)
```python
features = [
    temp_mean, temp_max,
    humidity_mean, humidity_max,
    # ... etc
]
```

**Rationale:** MAX captures transient events, doubles feature space gradually.

**Step 2:** Increase baseline window (20 → 60 samples)
```python
# Collect 60 samples (30 minutes) before training
baseline_window_size = 60
```

**Rationale:** 60 samples × 20 features = 1200 data points (sufficient for IsolationForest).

**Step 3:** Add Std values (20 → 30 features) after validating Step 2
```python
features = [
    temp_mean, temp_std, temp_max,
    # ... etc
]
```

**Rationale:** Only after proving 20-feature model works well.

---

## 6. Implementation Plan

### 6.1 Phase 1: Firmware Statistics (2-3 days)

**Changes:**
1. Add circular buffers to `sensor_aggregator.c`:
```c
static struct scd41_buffer scd41_buf;
static struct ccs811_buffer ccs811_buf;
static struct sps30_buffer sps30_buf;
```

2. Modify polling threads to fill buffers:
```c
// scd41_thread_fn
scd41_buf.temp[scd41_buf.write_idx] = d.temperature;
scd41_buf.write_idx = (scd41_buf.write_idx + 1) % SCD41_BUFFER_SIZE;
scd41_buf.count = MIN(scd41_buf.count + 1, SCD41_BUFFER_SIZE);
```

3. Add statistics calculation function:
```c
void sensor_aggregator_get_statistics(struct sensor_statistics *out);
```

4. Add Kconfig option:
```kconfig
config STATISTICAL_AGGREGATION
    bool "Enable statistical aggregation"
    default n
```

**Memory overhead:** ~500 bytes RAM (acceptable for nRF52840)

---

### 6.2 Phase 2: Gateway & Backend (3-4 days)

**Changes:**
1. Update gateway CBOR parser:
```python
if len(payload) == 88:
    parse_legacy_format()  # Current
elif len(payload) == 150:
    parse_statistics_format()  # New
```

2. Update MongoDB schema:
```java
// Support both formats
@Document(collection = "sensor_data")
public class SensorData {
    private Double temperature;  // Legacy
    private TemperatureStats temperatureStats;  // New
}

@Data
public class TemperatureStats {
    private Double mean;
    private Double std;
    private Double max;
}
```

3. Add backward compatibility layer:
```java
public Double getTemperature() {
    return temperatureStats != null ? temperatureStats.getMean() : temperature;
}
```

---

### 6.3 Phase 3: Rule-Based Event Detection (2-3 days)

**Changes:**
1. Add variance-based rules to `ml_engine.py`:
```python
def classify_with_variance(feature_vector, stats):
    # Transient VOC spike
    if stats['tvoc_std'] > 100 and stats['tvoc_max'] > 500:
        return "TRANSIENT_VOC_EVENT"
    
    # Unstable HVAC
    if stats['temp_std'] > 2.0:
        return "UNSTABLE_HVAC"
    
    # Variable PM source
    if stats['pm25_std'] > 10.0:
        return "VARIABLE_PARTICULATE_SOURCE"
    
    # Fall back to IsolationForest
    return run_isolation_forest(feature_vector)
```

2. Add new alert types to `Alert.java`:
```java
TRANSIENT_VOC_EVENT,
UNSTABLE_HVAC,
VARIABLE_PARTICULATE_SOURCE,
```

---

### 6.4 Phase 4: ML Feature Expansion (4-5 days)

**Step 1:** Add MAX to feature vector (10 → 20 features)
```python
features = [
    temp_mean, temp_max,
    humidity_mean, humidity_max,
    # ... etc
]
```

**Step 2:** Increase baseline window (20 → 60 samples)
```python
baseline_window_size = 60  # 30 minutes
```

**Step 3:** Retrain and validate model
```python
# Collect 60 samples in test environment
# Compare false positive rates: 10-feature vs 20-feature
```

**Step 4:** (Optional) Add Std if Step 3 succeeds (20 → 30 features)

---

## 7. Validation Strategy

### 7.1 A/B Testing

**Setup:**
- **Group A:** 50% of nodes with statistics (new)
- **Group B:** 50% of nodes with single values (current)

**Duration:** 4 weeks

**Metrics:**
| Metric | Group A (Stats) | Group B (Current) | Target |
|--------|-----------------|-------------------|--------|
| False positive rate | ? | Baseline | -20% |
| Transient event detection | ? | Baseline | +300% |
| Anomaly detection latency | ? | Baseline | <10% increase |
| Network bandwidth | 1.7x | 1.0x | <2x |

---

### 7.2 Test Scenarios

**Scenario 1: Stable Environment (Server Room)**
```
Expected: Low std for all sensors
Validation: Std < 0.5°C, < 1%RH, < 20ppm CO₂
```

**Scenario 2: Transient VOC Spike (Cleaning Spray)**
```
Expected: High tvoc_max, high tvoc_std
Validation: Max > 500 ppb, Std > 100 ppb
Detection: TRANSIENT_VOC_EVENT alert
```

**Scenario 3: Unstable HVAC (Oscillating Temperature)**
```
Expected: High temp_std, normal temp_mean
Validation: Std > 2.0°C, Mean = 22±1°C
Detection: UNSTABLE_HVAC alert
```

**Scenario 4: Cooking Activity (Kitchen)**
```
Expected: High tvoc_max, high temp_max, high humidity_max
Validation: Multi-variable spike
Detection: OCCUPANCY_EVENT or TRANSIENT_VOC_EVENT
```

---

## 8. Master's Thesis Research Questions

### RQ1: Does statistical aggregation improve anomaly detection accuracy?

**Hypothesis:** Statistical aggregation reduces false positives by 20-30% compared to single-point measurements.

**Methodology:**
- A/B test (4 weeks, 10 nodes)
- Metrics: False positive rate, true positive rate, F1 score
- Environments: Office, kitchen, server room

**Expected Outcome:** Std-based rules catch transient events that IsolationForest misses.

---

### RQ2: What is the optimal feature vector dimensionality for IsolationForest?

**Hypothesis:** 20 features (mean + max) provide better accuracy than 10 features (mean only) without overfitting.

**Methodology:**
- Train models with 10, 20, 30 features
- Compare with baseline window sizes: 20, 60, 120 samples
- Metrics: Detection accuracy, training time, inference latency

**Expected Outcome:** 20 features with 60-sample baseline is optimal.

---

### RQ3: Can variance-based rules complement ML anomaly detection?

**Hypothesis:** Hybrid approach (rules + ML) outperforms pure ML.

**Methodology:**
- Compare 3 approaches:
  1. IsolationForest only (current)
  2. Variance rules only (new)
  3. Hybrid (rules + IsolationForest)
- Metrics: Detection rate, false positive rate, interpretability

**Expected Outcome:** Hybrid approach achieves best balance.

---

### RQ4: What is the impact of per-sensor sampling rates on data quality?

**Hypothesis:** Respecting hardware update rates (5.5s for SCD41, 1s for CCS811) provides better data than uniform sampling.

**Methodology:**
- Compare uniform 5s sampling vs per-sensor optimal rates
- Metrics: Noise level (std of stable readings), transient event capture rate

**Expected Outcome:** Per-sensor rates capture 3x more transient events.

---

## 9. Conclusion

### 9.1 Key Findings

**Hardware Constraints:**
- ✅ SCD41 updates every 5 seconds (hardware limit)
- ✅ CCS811 updates every 1 second (rapid VOC changes)
- ✅ SPS30 updates every 1 second (PM trends)
- ✅ Current architecture already samples continuously

**Optimal Strategy:**
- ✅ Per-sensor circular buffers (respect hardware rates)
- ✅ Mean + Std + Max statistics (150 bytes, 1.7x overhead)
- ✅ 30-second transmission (real-time requirement)
- ✅ Hybrid detection (variance rules + IsolationForest)

**ML Architecture:**
- ⚠️ Don't jump to 30 features immediately (overfitting risk)
- ✅ Use Std as rule-based signal first (Phase 1)
- ✅ Gradually expand to 20 features (mean + max) with 60-sample baseline (Phase 2)
- ✅ Add Std to ML only after validation (Phase 3)

---

### 9.2 Recommendation

**Implement statistical aggregation with:**
1. **Per-sensor sampling rates** (5.5s, 1s, 1.5s)
2. **Mean + Std + Max** (45 values, 150 bytes)
3. **30-second transmission** (real-time alerting)
4. **Hybrid detection** (variance rules + IsolationForest)
5. **Gradual ML expansion** (10 → 20 → 30 features)

**Implementation Effort:** 11-15 days
- Phase 1 (Firmware): 2-3 days
- Phase 2 (Gateway/Backend): 3-4 days
- Phase 3 (Rule-based): 2-3 days
- Phase 4 (ML expansion): 4-5 days

**Expected Impact:**
- 20-30% reduction in false positives
- 3x improvement in transient event detection
- Suitable for Master's thesis with 4 research questions

---

**Document Version:** 2.0 (Hardware-Aware)  
**Last Updated:** 2026-06-12  
**Status:** Production-grade proposal