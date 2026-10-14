# Event Classification Taxonomy - Architecture-Aware Analysis

**Based on:** Actual SSNS codebase analysis (2026-06-12)  
**Purpose:** Master's thesis on intelligent indoor environmental monitoring  
**Approach:** Evidence-based recommendations from implemented architecture

---

## Executive Summary

**Current State:** The system implements **9 distinct alert types** across 3 categories (Operational, AI, Infrastructure).

**Recommendation:** Extend to **6 event classes** that align with existing architecture while adding minimal complexity.

**Key Finding:** The codebase already supports multi-variable anomaly detection (IsolationForest) and time-series forecasting, making it suitable for sophisticated event classification with minimal changes.

---

## 1. Current Architecture Analysis

### 1.1 Integrated Sensors (Firmware)

**File:** [`firmware/sensor-node/src/sensors.h`](../firmware/sensor-node/src/sensors.h)

| Sensor | Measurements | Status | Hardware |
|--------|-------------|--------|----------|
| **SCD41** | Temperature, Humidity, CO₂ | ✅ Implemented | Sensirion SCD41 |
| **CCS811** | TVOC, eCO₂ | ✅ Implemented | AMS CCS811 |
| **SPS30** | PM1.0, PM2.5, PM4.0, PM10 | ✅ Implemented | Sensirion SPS30 |
| **Light** | Intensity (lux) | ✅ Implemented | Generic photoresistor |

**Total:** 10 environmental features transmitted every 30 seconds.

---

### 1.2 Existing Detection Mechanisms

#### A. Threshold-Based Detection (Backend)

**File:** [`AlertService.java:45-94`](../platform/api/src/main/java/de/iot/smartmonitoring/service/AlertService.java#L45-L94)

**Implementation:**
```java
// Configurable thresholds from application.yml
temperature-max: 35.0°C
temperature-min: 10.0°C
co2-max: 1500.0 ppm
pm25-max: 35.0 µg/m³
tvoc-max: 1000.0 ppb
```

**Alert Types Generated:**
- `TEMPERATURE_HIGH` / `TEMPERATURE_LOW`
- `HIGH_CO2`
- `HIGH_PARTICULATES`
- `HIGH_VOC`

**Characteristics:**
- ✅ Real-time (< 250ms latency)
- ✅ Simple to configure
- ✅ Deterministic
- ❌ No context awareness
- ❌ No multi-variable correlation

---

#### B. ML-Based Anomaly Detection (ML Service)

**File:** [`ml_engine.py:42-120`](../platform/ml-service/app/ml/ml_engine.py#L42-L120)

**Algorithm:** IsolationForest (scikit-learn)

**Implementation:**
```python
# 10-dimensional feature vector
features = [temp, humidity, co2, tvoc, eco2, pm1_0, pm2_5, pm4_0, pm10, light]

# Training: 20+ samples (10 mins) to learn baseline
model.fit(baseline_data)

# Detection: Anomaly score + top 2 drivers
is_anomaly = model.predict(new_sample) == -1
score = model.decision_function(new_sample)
top_drivers = identify_top_2_deviations(new_sample, baseline)
```

**Alert Type Generated:**
- `ML_ANOMALY`

**Characteristics:**
- ✅ Multi-variable correlation
- ✅ Adaptive to environment
- ✅ Identifies key drivers dynamically
- ✅ Context-aware (baseline learning)
- ❌ Requires training period (10 mins)
- ❌ Generic "anomaly" without event classification

---

#### C. Time-Series Forecasting (ML Service)

**File:** [`forecaster.py:7-86`](../platform/ml-service/app/ml/forecaster.py#L7-L86)

**Algorithm:** Linear regression on rolling window (60 samples)

**Implementation:**
```python
# Forecast CO₂ and PM2.5 trends
proj_co2 = co2_slope * (current_time + horizon) + co2_intercept
proj_pm25 = pm25_slope * (current_time + horizon) + pm25_intercept

# Alert if projected breach within 30 minutes
if proj_co2 > 1500 or proj_pm25 > 35:
    generate_forecast_warning()
```

**Alert Type Generated:**
- `FORECAST_WARNING`

**Characteristics:**
- ✅ Proactive (30-min lookahead)
- ✅ Trend-aware
- ✅ Actionable (time to intervene)
- ❌ Only 2 features (CO₂, PM2.5)
- ❌ Simple linear model (no seasonality)

---

#### D. Hardware Fault Detection (Backend)

**File:** [`AlertService.java:234-268`](../platform/api/src/main/java/de/iot/smartmonitoring/service/AlertService.java#L234-L268)

**Implementation:**
```java
// Health status bitmask from firmware
// Bit 0: SCD41 Temp/Hum
// Bit 1: SCD41 CO₂
// Bit 2: SPS30 PM
// Bit 3: CCS811 TVOC

if (healthStatus != 0x0F) {
    // Identify faulty sensor(s)
    generate_hardware_fault_alert();
}
```

**Alert Type Generated:**
- `HARDWARE_FAULT`

**Characteristics:**
- ✅ Real-time sensor diagnostics
- ✅ Specific sensor identification
- ✅ Critical severity
- ✅ Actionable (wiring, power, I2C)

---

#### E. Node Connectivity Monitoring (Backend)

**File:** [`NodeHealthMonitor.java:42-73`](../platform/api/src/main/java/de/iot/smartmonitoring/monitoring/NodeHealthMonitor.java#L42-L73)

**Implementation:**
```java
// Scheduled check every 30 seconds
if (node.lastSeenAt < now - 120 seconds) {
    node.status = OFFLINE;
    generate_node_offline_alert();
}
```

**Alert Type Generated:**
- `NODE_OFFLINE`

**Characteristics:**
- ✅ Infrastructure monitoring
- ✅ Automatic recovery detection
- ✅ Configurable timeout

---

### 1.3 Current Alert Taxonomy

**File:** [`Alert.java:51-65`](../platform/api/src/main/java/de/iot/smartmonitoring/model/Alert.java#L51-L65)

```java
public enum AlertType {
    // Operational (6 types)
    TEMPERATURE_HIGH,
    TEMPERATURE_LOW,
    HIGH_CO2,
    HIGH_PARTICULATES,
    HIGH_VOC,
    HARDWARE_FAULT,
    
    // AI (2 types)
    ML_ANOMALY,
    FORECAST_WARNING,
    
    // Infrastructure (1 type)
    NODE_OFFLINE,
    
    // Deprecated
    @Deprecated AIR_QUALITY_POOR,
    @Deprecated LIGHT_INTENSITY_HIGH
}
```

**Categories:**
- **Operational:** 6 types (threshold-based + hardware faults)
- **AI:** 2 types (ML anomaly + forecasting)
- **Infrastructure:** 1 type (connectivity)

---

## 2. Gap Analysis: What's Missing?

### 2.1 Event Context Classification

**Problem:** `ML_ANOMALY` is too generic.

**Example:**
```
Current: "ML Anomaly Detected | Drivers: CO₂ (+85%), TVOC (+216%)"
Missing: What type of event is this?
  - Occupancy change?
  - Chemical spill?
  - Cooking activity?
  - HVAC failure?
```

**Impact:** Users must interpret anomalies manually.

---

### 2.2 Rate-of-Change Detection

**Problem:** No detection of rapid changes.

**Example:**
```
Scenario: Door opens, CO₂ drops from 1200 → 600 ppm in 2 minutes
Current: No alert (both values below threshold)
Missing: Rapid ventilation event detection
```

**Impact:** Misses transient events that don't breach thresholds.

---

### 2.3 Multi-Sensor Correlation Rules

**Problem:** No explicit correlation logic.

**Example:**
```
Scenario: Temp +5°C, Humidity +20%, TVOC +300 ppb (cooking)
Current: 3 separate threshold alerts OR 1 generic ML anomaly
Missing: "Cooking Activity Detected" event
```

**Impact:** Alert fatigue from multiple related alerts.

---

### 2.4 Temporal Pattern Recognition

**Problem:** No time-of-day or occupancy pattern awareness.

**Example:**
```
Scenario: CO₂ rises to 800 ppm at 9 AM (office arrival)
Current: Might trigger ML anomaly if baseline is empty office
Missing: "Normal Occupancy Pattern" classification
```

**Impact:** False positives during predictable events.

---

## 3. Proposed Event Classification Taxonomy

Based on **actual architecture capabilities** and **realistic extensions**.

---

### Event Class 1: **Occupancy Events**

**Definition:** Changes in human presence detected via CO₂, TVOC, and temperature correlation.

**Detection Logic:**
```python
# Multi-variable signature
co2_increase = (co2 > baseline_co2 + 200 ppm)
tvoc_increase = (tvoc > baseline_tvoc + 50 ppb)
temp_increase = (temp > baseline_temp + 1.5°C)
pm_stable = (pm2_5 < baseline_pm25 + 5 µg/m³)

if co2_increase and tvoc_increase and temp_increase and pm_stable:
    return "OCCUPANCY_INCREASE"
```

**Supported by:**
- ✅ SCD41 (CO₂, Temperature)
- ✅ CCS811 (TVOC)
- ✅ IsolationForest (multi-variable correlation)

**Implementation Effort:** **Low**
- Extend `ml_engine.py` with rule-based classifier
- Add new alert type: `OCCUPANCY_EVENT`
- Use existing feature vector

**Example Alert:**
```
Type: OCCUPANCY_INCREASE
Severity: INFO
Message: "Occupancy detected: CO₂ +250 ppm, TVOC +80 ppb, Temp +2°C"
Action: "Normal occupancy pattern. No action required."
```

---

### Event Class 2: **Transient VOC Events**

**Definition:** Rapid TVOC spike without sustained elevation (cleaning, perfume, cooking).

**Detection Logic:**
```python
# Rate-of-change detection
tvoc_rate = (current_tvoc - prev_tvoc) / time_delta
tvoc_spike = (tvoc_rate > 50 ppb/min)
tvoc_transient = (tvoc returns to baseline within 10 mins)

if tvoc_spike and tvoc_transient:
    return "TRANSIENT_VOC_EVENT"
```

**Supported by:**
- ✅ CCS811 (TVOC)
- ✅ 30-second sampling rate
- ⚠️ Requires rate-of-change calculation (NEW)

**Implementation Effort:** **Medium**
- Add rate-of-change tracker to `poller.py`
- Store last 5 readings per node
- Add new alert type: `TRANSIENT_VOC`

**Example Alert:**
```
Type: TRANSIENT_VOC
Severity: INFO
Message: "Transient VOC spike: 250 → 850 ppb in 2 mins, returning to baseline"
Action: "Likely cleaning or cooking activity. Monitor for sustained elevation."
```

---

### Event Class 3: **Particulate Events**

**Definition:** PM2.5/PM10 elevation from external sources (outdoor pollution, construction, smoking).

**Detection Logic:**
```python
# PM-dominant signature
pm_increase = (pm2_5 > baseline_pm25 + 15 µg/m³)
co2_stable = (abs(co2 - baseline_co2) < 100 ppm)
tvoc_stable = (abs(tvoc - baseline_tvoc) < 50 ppb)

if pm_increase and co2_stable and tvoc_stable:
    return "PARTICULATE_EVENT"
```

**Supported by:**
- ✅ SPS30 (PM1.0, PM2.5, PM4.0, PM10)
- ✅ IsolationForest (identifies PM as top driver)

**Implementation Effort:** **Low**
- Extend `ml_engine.py` with PM-specific rules
- Add new alert type: `PARTICULATE_EVENT`

**Example Alert:**
```
Type: PARTICULATE_EVENT
Severity: WARNING
Message: "PM2.5 elevated to 45 µg/m³ (outdoor pollution suspected)"
Action: "Close external windows. Check air filter status."
```

---

### Event Class 4: **Sustained Environmental Change**

**Definition:** Gradual multi-variable drift over hours (HVAC failure, seasonal change, window left open).

**Detection Logic:**
```python
# Trend detection over 1-hour window
temp_trend = linear_regression(temp_history_1h)
co2_trend = linear_regression(co2_history_1h)

if abs(temp_trend.slope) > 0.5°C/hour or abs(co2_trend.slope) > 100 ppm/hour:
    return "SUSTAINED_ENVIRONMENTAL_CHANGE"
```

**Supported by:**
- ✅ All sensors
- ✅ Forecaster already implements linear regression
- ⚠️ Extend to all features (currently only CO₂, PM2.5)

**Implementation Effort:** **Medium**
- Extend `forecaster.py` to track all 10 features
- Add trend analysis for temperature, humidity, TVOC
- Add new alert type: `SUSTAINED_CHANGE`

**Example Alert:**
```
Type: SUSTAINED_ENVIRONMENTAL_CHANGE
Severity: WARNING
Message: "Temperature declining -3°C over 2 hours (HVAC failure suspected)"
Action: "Inspect heating system. Check thermostat settings."
```

---

### Event Class 5: **Sensor Fault Events**

**Definition:** Hardware sensor failures detected via health bitmask or fault values.

**Detection Logic:**
```python
# Already implemented!
if healthStatus != 0x0F:
    identify_faulty_sensors()
    return "HARDWARE_FAULT"

if any(value == -999.0):
    return "HARDWARE_FAULT"
```

**Supported by:**
- ✅ Firmware health bitmask
- ✅ Backend fault detection
- ✅ ML service fault filtering

**Implementation Effort:** **None** (already implemented)

**Current Alert:**
```
Type: HARDWARE_FAULT
Severity: CRITICAL
Message: "Physical sensor failure detected: SCD41 (CO₂)"
Action: "Verify CO₂ sensor I2C connection."
```

---

### Event Class 6: **Unknown Anomaly**

**Definition:** Multi-variable anomaly that doesn't match any specific pattern (catch-all).

**Detection Logic:**
```python
# IsolationForest detects anomaly
if is_anomaly and not matches_any_pattern():
    return "UNKNOWN_ANOMALY"
```

**Supported by:**
- ✅ IsolationForest (already implemented)
- ✅ Driver identification (already implemented)

**Implementation Effort:** **None** (already implemented as `ML_ANOMALY`)

**Current Alert:**
```
Type: ML_ANOMALY
Severity: WARNING
Message: "IsolationForest detected unusual multi-variable behavior pattern"
Context: "Anomaly score: -0.23 | Key drivers: Temp (+26%), CO₂ (+85%)"
Action: "Inspect HVAC unit."
```

---

## 4. Implementation Roadmap

### Phase 1: Rule-Based Event Classifier (Low Effort)

**Goal:** Classify ML anomalies into specific event types.

**Changes:**
1. Add event classifier to `ml_engine.py`:
```python
def classify_anomaly(feature_vector, baseline, top_drivers):
    if matches_occupancy_pattern():
        return "OCCUPANCY_EVENT"
    elif matches_particulate_pattern():
        return "PARTICULATE_EVENT"
    elif matches_transient_voc_pattern():
        return "TRANSIENT_VOC"
    else:
        return "UNKNOWN_ANOMALY"
```

2. Add new alert types to `Alert.java`:
```java
OCCUPANCY_EVENT,
PARTICULATE_EVENT,
TRANSIENT_VOC,
```

3. Update dashboard to display event-specific icons and colors.

**Estimated Time:** 2-3 days  
**Impact:** High (immediate event classification)

---

### Phase 2: Rate-of-Change Detection (Medium Effort)

**Goal:** Detect rapid changes and transient events.

**Changes:**
1. Add rolling window tracker to `poller.py`:
```python
class RateOfChangeTracker:
    def __init__(self, window_size=5):
        self.history = deque(maxlen=window_size)
    
    def add_reading(self, timestamp, features):
        self.history.append((timestamp, features))
    
    def calculate_rates(self):
        # Return rate-of-change for each feature
        pass
```

2. Integrate with anomaly detection:
```python
rates = rate_tracker.calculate_rates()
if rates['tvoc'] > 50:  # ppb/min
    return "TRANSIENT_VOC"
```

**Estimated Time:** 3-4 days  
**Impact:** Medium (catches transient events)

---

### Phase 3: Extended Forecasting (Medium Effort)

**Goal:** Forecast all features, not just CO₂ and PM2.5.

**Changes:**
1. Extend `forecaster.py` to track all 10 features:
```python
class ExtendedForecaster:
    def forecast_all_features(self, horizon_sec):
        projections = {}
        for feature in ['temp', 'humidity', 'co2', 'tvoc', ...]:
            projections[feature] = self.forecast_single(feature, horizon_sec)
        return projections
```

2. Add sustained change detection:
```python
if abs(temp_slope) > 0.5:  # °C/hour
    return "SUSTAINED_ENVIRONMENTAL_CHANGE"
```

**Estimated Time:** 4-5 days  
**Impact:** Medium (proactive sustained change detection)

---

## 5. Final Event Taxonomy

| Event Class | Detection Method | Sensors | Effort | Status |
|-------------|------------------|---------|--------|--------|
| **1. Occupancy Events** | Multi-variable rules | CO₂, TVOC, Temp | Low | ⚠️ Extend |
| **2. Transient VOC Events** | Rate-of-change | TVOC | Medium | ❌ New |
| **3. Particulate Events** | PM-dominant rules | PM2.5, PM10 | Low | ⚠️ Extend |
| **4. Sustained Environmental Change** | Trend analysis | All sensors | Medium | ⚠️ Extend |
| **5. Sensor Fault Events** | Health bitmask | All sensors | None | ✅ Implemented |
| **6. Unknown Anomaly** | IsolationForest | All sensors | None | ✅ Implemented |

---

## 6. Justification for Master's Thesis

### 6.1 Technical Rigor

**Strengths:**
- ✅ Based on actual production codebase
- ✅ Multi-sensor fusion (10 features)
- ✅ ML-based anomaly detection (IsolationForest)
- ✅ Time-series forecasting (linear regression)
- ✅ Real-time processing (<250ms latency)
- ✅ Distributed architecture (firmware → gateway → backend → ML)

**Novel Contributions:**
1. **Hybrid detection:** Combines threshold-based, ML-based, and rule-based approaches
2. **Context-aware classification:** Extends generic anomalies to specific event types
3. **Multi-modal sensing:** Correlates environmental, chemical, and particulate data
4. **Proactive forecasting:** 30-minute lookahead for preventive action

---

### 6.2 Practical Relevance

**Real-World Applications:**
- Office buildings (occupancy optimization)
- Smart homes (air quality management)
- Industrial facilities (safety monitoring)
- Healthcare (infection control via ventilation)

**Measurable Impact:**
- Reduced false positive rate (event classification vs generic anomalies)
- Faster response time (proactive forecasting)
- Lower maintenance costs (hardware fault detection)

---

### 6.3 Research Questions

**Suitable for Master's Thesis:**

1. **RQ1:** How effective is multi-variable anomaly detection compared to single-threshold approaches for indoor air quality monitoring?
   - **Method:** Compare IsolationForest vs threshold-based alerts
   - **Metrics:** False positive rate, detection latency, user satisfaction

2. **RQ2:** Can rule-based event classification improve interpretability of ML-detected anomalies?
   - **Method:** User study comparing generic vs classified anomalies
   - **Metrics:** Time to understand alert, confidence in action, resolution rate

3. **RQ3:** What is the optimal baseline window size for adaptive anomaly detection in variable environments?
   - **Method:** Test 20, 60, 120, 1440 sample baselines in office, kitchen, server room
   - **Metrics:** False positive rate, adaptation time, detection accuracy

4. **RQ4:** How accurate is linear regression forecasting for proactive air quality management?
   - **Method:** Compare 30-min forecasts vs actual measurements
   - **Metrics:** RMSE, MAE, breach prediction accuracy

---

## 7. Conclusion

### Current State
The SSNS platform implements a **sophisticated multi-layer detection system** with:
- 10 environmental sensors
- 9 alert types across 3 categories
- IsolationForest ML anomaly detection
- Linear regression forecasting
- Hardware fault detection
- Node connectivity monitoring

### Recommended Taxonomy
Extend to **6 event classes** that align with existing architecture:
1. ✅ **Sensor Fault Events** (already implemented)
2. ✅ **Unknown Anomaly** (already implemented as ML_ANOMALY)
3. ⚠️ **Occupancy Events** (extend with rules)
4. ⚠️ **Particulate Events** (extend with rules)
5. ❌ **Transient VOC Events** (add rate-of-change)
6. ⚠️ **Sustained Environmental Change** (extend forecaster)

### Implementation Effort
- **Phase 1 (Low):** 2-3 days - Rule-based classifier
- **Phase 2 (Medium):** 3-4 days - Rate-of-change detection
- **Phase 3 (Medium):** 4-5 days - Extended forecasting

**Total:** 9-12 days of development

### Thesis Suitability
**Highly suitable** for Master's thesis due to:
- Real production system (not toy example)
- Novel hybrid detection approach
- Measurable impact on user experience
- Multiple research questions
- Practical applications

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-12  
**Author:** Architecture Analysis based on SSNS codebase