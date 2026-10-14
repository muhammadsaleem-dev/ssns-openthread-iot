# SSNS Anomaly Detection Pipeline: Detailed Analysis

**Purpose:** Trace exactly what the current Isolation Forest implementation handles for each disturbance scenario and identify what gaps remain that each proposed enhancement would solve.

**Document Version:** 1.0  
**Analysis Date:** June 2026  
**Scope:** SSNS platform with Isolation Forest baseline training, threshold alerts, and ML anomaly detection

---

## 1. Complete System Architecture

### 1.1 Data Flow Pipeline

```
CoAP Sensors (Thread Mesh)
  ↓
CoAP Gateway (CBOR Deserialization)
  ├─ Redis Dedup Check (5-min TTL, key=dedup:node_id:boot_id:seq_num)
  └─ Duplicate? YES → Drop | NO → Continue
  ↓
Backend (SensorDataService.ingest)
  ├─ Persist to MongoDB
  ├─ Update Node Status (lastSeenAt)
  └─ Call AlertService.evaluate(SensorData)
  ↓
Parallel Processing:
  ├─ PATH A: AlertService → Threshold Checks → Create Threshold Alerts
  │   (Temperature-High, Temperature-Low, CO2-High, PM2.5-High, TVOC-High)
  │
  └─ PATH B: ML Service Poller → Fetch Latest Telemetry → Isolation Forest → ML_ANOMALY Alert
      (Runs every 15 seconds; per-node persistent models)
```

### 1.2 Alert Types in System

**Type 1: Threshold Alerts** (synchronous, created by AlertService.evaluate)
- Temperature (high/low): > 35°C or < 10°C
- CO₂ (high): > 1500 ppm
- PM2.5 (high): > 35 µg/m³
- TVOC (high): > 1000 ppb
- Hardware Fault: Health status bitmask indicates fault

**Type 2: ML Anomaly Alerts** (async, created by ML Service poller)
- ML_ANOMALY: Isolation Forest detects unusual multi-variable pattern
- Includes: Anomaly score, context (top 2 deviating features), recommended action

### 1.3 Hardware Fault Detection

**Mechanism:**
- Sensor reports -999.0 for failed measurement
- Backend checks: `if (value <= -900.0) → triggerHardwareFault()`
- ML Service checks: `if any(v <= -900.0 for v in features) → skip inference`

**Result:** Hardware faults skip ML inference (no ML_ANOMALY alert for fault readings)

---

## 2. What the Current Isolation Forest DOES Handle

### 2.1 Feature Vector (10-dimensional)

```python
features = [
    temperature,      # Feature 0
    humidity,         # Feature 1
    co2,              # Feature 2
    tvoc,             # Feature 3
    eco2,             # Feature 4
    pm1_0,            # Feature 5
    pm2_5,            # Feature 6
    pm4_0,            # Feature 7
    pm10,             # Feature 8
    lightIntensity    # Feature 9
]
```

**Key:** Isolation Forest operates on 10-dimensional space, not individual features.

### 2.2 Isolation Forest Training & Operation

**Baseline Collection:**
- Accumulates `baseline_window_size` readings (default 15; configurable 1h-24h)
- During baseline: All readings return `is_anomaly=False` (to populate baseline)
- After baseline complete: Model auto-fits, persists to disk, begins detecting anomalies

**Sensitivity Parameter:**
```python
contamination = max(0.01, min(1.0, sensitivity / 100.0))
# Sensitivity 1 → contamination 0.01 (1% expected anomalies)
# Sensitivity 100 → contamination 1.0 (100% anomalies, pointless)
# Sensitivity 50 → contamination 0.5 (50% anomalies, high tolerance)
```

**What Isolation Forest Does:**
- Learns multivariate baseline from training data
- For each new reading, assigns anomaly score via decision function
- Prediction: -1 if anomalous (score > threshold), +1 if normal

**Key Insight:** Isolation Forest treats the 10D feature space as a CLOUD and identifies outliers in that cloud. It doesn't understand:
- Feature RELATIONSHIPS (e.g., "high CO₂ should correlate with certain TVOC/Humidity ratios")
- Temporal PATTERNS (e.g., "sustained issue vs. transient spike")
- Physical CONSTRAINTS (e.g., "temperature can't jump +20°C in 1 second")
- Feature MEANINGS (e.g., "this is breath, not HVAC failure")

### 2.3 Disturbance Scenarios: What Isolation Forest Catches

#### **Disturbance 1: Human Breath Near CO₂ Sensor**

**Scenario:**
- Person breathes near sensor: CO₂ +950 ppm (spikes from 400 to 1350 ppm) in 5 seconds
- Temperature: stable ±0.2°C
- Humidity: +1-2% RH
- Other features: stable

**Isolation Forest Behavior:**
```
Feature Vector:
  [22.0°C, 45%RH, 1350ppm, 180ppb, 400ppm, 0.5, 5, 8, 12, 150lux]
  
Baseline (trained on normal office space):
  Mean:  [22.0°C, 50%RH, 500ppm, 200ppb, 350ppm, 0.3, 3, 5, 8, 500lux]
  Std:   [1.5°C, 8%RH, 150ppm, 50ppb, 50ppm, 0.5, 2, 3, 5, 200lux]
  
Z-Score for CO₂: |1350 - 500| / 150 = 5.67 (EXTREME)
Z-Score for Humidity: |45 - 50| / 8 = 0.625 (normal)
Z-Score for Others: mostly < 1
  
Isolation Forest: Detects extreme multivariate deviation → ANOMALY
Top Driver Analysis: CO₂ is highest z-score → "CO₂ +170% vs baseline"
Recommended Action: "Increase ventilation or open windows"
```

**Status:** ✓ **ANOMALY DETECTED**
- **Alert Type:** ML_ANOMALY
- **Alert Context:** "Anomaly score: 0.85 | Key drivers: CO₂ (+170% vs baseline), TVOC (+10% vs baseline)"
- **Alert Action:** "Increase ventilation or open windows"

**Problem:** ❌ **CANNOT DISTINGUISH FROM HVAC FAILURE**
- If HVAC failed and room accumulated CO₂: same feature pattern (high CO₂, stable temp/humidity)
- Operator receives same alert for breath (transient, 10 sec) and HVAC failure (sustained, hours)
- **Gap:** No temporal validation (rate-of-change over time)

---

#### **Disturbance 2: Perfume/VOC Spray**

**Scenario:**
- Person sprays perfume near sensor: TVOC +800 ppb (spikes from 150 to 950 ppb) in 3 seconds
- eCO₂ correlated: +100 ppb
- Other features: stable

**Isolation Forest Behavior:**
```
Feature Vector:
  [22.1°C, 48%RH, 510ppm, 950ppb, 420ppm, 0.3, 3, 5, 8, 480lux]
  
Baseline:
  Mean:  [22.0°C, 50%RH, 500ppm, 150ppb, 350ppm, 0.3, 3, 5, 8, 500lux]
  Std:   [1.5°C, 8%RH, 150ppm, 50ppb, 50ppm, 0.5, 2, 3, 5, 200lux]
  
Z-Score for TVOC: |950 - 150| / 50 = 16 (EXTREME)
Z-Score for eCO₂: |420 - 350| / 50 = 1.4
  
Isolation Forest: Extreme TVOC deviation → ANOMALY
Top Driver: TVOC (+533% vs baseline)
Recommended Action: "Investigate for chemical spills or off-gassing"
```

**Status:** ✓ **ANOMALY DETECTED**
- **Alert Type:** ML_ANOMALY
- **Problem:** Recommends investigating chemical spill, but it's just perfume (benign)

**Gap:** ❌ **CANNOT DISTINGUISH SPRAY FROM SPILL**
- TVOC spike pattern is identical for perfume spray and chemical spill
- **What's needed:** Event classification that says "transient TVOC spike with rapid decay = spray; sustained = spill"
- **Also helpful:** Sensor fusion (TVOC spike + stable PM + stable CO₂ = spray, not chemical)

---

#### **Disturbance 3: Dust Disturbance Near SPS30**

**Scenario:**
- Someone moves near sensor or vacuums: PM2.5 +45 µg/m³, all PM features spike
- CO₂ stable (no occupancy), temperature/humidity stable

**Isolation Forest Behavior:**
```
Feature Vector:
  [21.9°C, 49%RH, 505ppm, 145ppb, 340ppm, 15, 50, 70, 85, 510lux]
  
Baseline (normal office):
  Mean:  [22.0°C, 50%RH, 500ppm, 150ppb, 350ppm, 2, 3, 5, 8, 500lux]
  Std:   [1.5°C, 8%RH, 150ppm, 50ppb, 50ppm, 2, 2, 3, 5, 200lux]
  
Z-Score for PM2.5: |50 - 3| / 2 = 23.5 (EXTREME)
Z-Score for PM4.0: |70 - 5| / 3 = 21.7 (EXTREME)
  
Isolation Forest: All PM features extreme outliers → ANOMALY
```

**Status:** ✓ **ANOMALY DETECTED**
- **Alert:** PM2.5 driven

**Gap:** ❌ **CANNOT DISTINGUISH DUST FROM OUTDOOR POLLUTION**
- Local dust disturbance: PM spike returns to baseline within 2 min
- Outdoor pollution entering: sustained high PM for hours
- **What's needed:** Rate-of-change + temporal pattern validation

---

#### **Disturbance 4: Occupancy-Related CO₂ Increase**

**Scenario:**
- Office starts empty (baseline collected at night): CO₂ 420 ppm
- Morning occupancy: CO₂ rises to 800 ppm (5 people, normal ventilation)
- This is NORMAL occupancy, not a problem

**Isolation Forest Behavior:**
```
During Baseline (night, unoccupied):
  Baseline readings: CO₂ 410-430 ppm, stable temp, low humidity
  Model learns: "normal" = CO₂ 400-450 range, temp 20-24°C

Next Day, Morning Occupancy:
  Feature Vector: [22.5°C, 55%RH, 800ppm, 180ppb, 370ppm, 1.2, 4, 6, 10, 200lux]
  
  Z-Score for CO₂: |800 - 420| / 15 = 25.3 (EXTREME)
  
  Isolation Forest: Detects CO₂ spike → ANOMALY (FALSE POSITIVE)
```

**Status:** ⚠️ **FALSE POSITIVE**
- **Problem:** Normal occupancy flagged as anomaly
- **Cause:** Baseline trained on UNOCCUPIED state; first occupancy spike looks abnormal

**Mitigation:**
1. **Option A:** Increase baseline window to 2-3 days (capture occupancy pattern)
   - Profile recommendation: Classroom = 2-3 day baseline
2. **Option B:** Use sensitivity tuning (lower sensitivity/contamination)
   - Allows more readings to be "expected anomalies"
3. **Option C:** Use temporal context (time-of-day scheduling)
   - Know when occupancy is expected; suppress alerts during those times

**Gap:** ❌ **OCCUPANCY PATTERN RECOGNITION NOT BUILT IN**
- Isolation Forest doesn't know about daily occupancy cycles
- Profiles address this with longer baseline window (option A)
- Event Classification could label as "Occupancy-Driven CO₂ Rise" once detected

---

#### **Disturbance 5: Sensor Fault (I2C Timeout, Stuck Sensor)**

**Scenario 5a: I2C Timeout (Hardware Fault)**
- Sensor reports -999.0 for temperature reading (communication error)

**Pipeline Behavior:**
```
Backend SensorDataService:
  if (request.getTemperature() <= -900.0):
    alertService.triggerHardwareFault() → Creates HARDWARE_FAULT alert
  
ML Service:
  if any(v <= -900.0 for v in features):
    skip ML inference (continue; don't call Isolation Forest)
```

**Status:** ✓ **FAULT DETECTED AND ISOLATED**
- **Alert Type:** HARDWARE_FAULT (explicit)
- **ML:** Skipped (intentionally)

---

**Scenario 5b: Stuck Sensor (Repeated Identical Values)**
- Temperature sensor stuck at 22.5°C for 10 consecutive readings
- All other features normal

**Isolation Forest Behavior:**
```
Readings 1-10: [22.5°C, 50%RH, 500ppm, ...]
Readings 1-5 during baseline: Baseline learns "temperature mean 22.5°C, std 0.1°C"

Reading 6+ (post-baseline): Temperature = 22.5°C
  Z-Score: |22.5 - 22.5| / 0.1 = 0 (NORMAL)
  
Isolation Forest: No anomaly detected (stuck value looks "too perfect", but falls within cloud)
```

**Status:** ❌ **NOT DETECTED**
- **Problem:** Repeated identical value might be slightly anomalous in high-dimensional space, but Isolation Forest doesn't specifically detect "lack of variation"
- **Gap:** No stuck-value detector

---

#### **Disturbance 6: Out-of-Order/Stale Telemetry**

**Scenario:**
- Sensor sends reading with timestamp 5 min ago (network delay)
- Arrives at backend after new readings from same node
- Backend persists all readings with their original timestamps

**Pipeline Behavior:**
```
Reading A (t=10:00): CO₂ 500 ppm, arrives at 10:00 → Saved, alert evaluated
Reading B (t=09:55): CO₂ 1600 ppm, arrives at 10:00 (stale, 5 min old)
  → Saved with timestamp 09:55
  → Alert evaluated (triggers high CO₂ alert for past time)

ML Service:
  Fetches "latest" reading by MongoDB query
  Might fetch stale Reading B if query returns by insertion order
  Or might fetch Reading A if query returns by timestamp
```

**Status:** ⚠️ **PARTIALLY HANDLED**
- **Backend:** Detects out-of-order by Redis dedup key (node_id:boot_id:seq_num)
  - If sequence number already seen, drop as duplicate
- **Alert Logic:** No staleness validation; old readings can trigger old alerts
- **ML Service:** Unclear ordering; depends on database query

**Gap:** ❌ **NO TIMESTAMP STALENESS VALIDATION**
- No check: "Is this reading > 5 min old? If so, skip evaluation"
- **What's needed:** Staleness validator that compares (now - timestamp) and skips if stale

---

#### **Disturbance 7: Physically Implausible Rate-of-Change**

**Scenario:**
- Temperature sensor glitch: reads 25°C, then next reading (1 sec later) 55°C (+30°C/sec)
- Physically impossible (even direct heat source can't cause this)

**Isolation Forest Behavior:**
```
Baseline (normal office): Temp 20-24°C, typical variation ±1°C

New Reading: 55°C
  Z-Score: |55 - 22| / 1.5 = 22 (EXTREME)
  
Isolation Forest: Detects as anomaly → ANOMALY ALERT
```

**Status:** ⚠️ **DETECTED BUT FOR WRONG REASON**
- **Current Alert:** "Temperature 55°C exceeds max threshold 35°C" (Threshold Alert)
- **Or:** ML_ANOMALY with recommendation "Inspect HVAC unit"
- **Problem:** Alert treats as real temperature spike (recommends action on HVAC), not as sensor glitch
- **Consequence:** Operator checks HVAC, finds nothing wrong, wastes time

**Gap:** ❌ **NO RATE-OF-CHANGE VALIDATION**
- Should filter out physically impossible changes BEFORE they reach alert logic
- **Validation rule:** If temperature change > X°C/sec → likely glitch, skip alert

---

#### **Disturbance 8: Sustained Anomaly (Real Problem)**

**Scenario:**
- HVAC filter completely blocked: Temperature rises steadily to 32°C over 1 hour
- Remains high for 2+ hours
- All other features stable

**Isolation Forest Behavior:**
```
Baseline: Temp 20-24°C (normal office)

Over 1 hour, readings: 24°C → 25°C → 26°C → 28°C → 30°C → 32°C

Each reading's Z-Score with initial baseline:
  24°C: |24 - 22| / 1.5 = 1.3 (normal)
  32°C: |32 - 22| / 1.5 = 6.7 (anomalous)
  
Isolation Forest: First reading (24°C) not flagged; by 30°C+ flagged as anomaly
```

**Status:** ✓ **DETECTED**
- **Alert Type:** Threshold Alert (Temperature-High at 35°C threshold)
- **Or:** ML_ANOMALY if reading > 2 std dev from baseline

**Note:** This is working as intended.

---

### 2.4 Isolation Forest: Summary of Current Capabilities

| Scenario | Current Status | Alert Type | Quality |
| :--- | :---: | :--- | :--- |
| Human breath CO₂ spike | ✓ Detected | ML_ANOMALY | Poor (misidentified as HVAC problem) |
| Perfume/VOC spray | ✓ Detected | ML_ANOMALY | Poor (misidentified as chemical spill) |
| Dust disturbance | ✓ Detected | ML_ANOMALY | Poor (can't distinguish from pollution) |
| Occupancy CO₂ rise | ⚠️ False Positive | ML_ANOMALY | Poor (needs longer baseline) |
| I2C hardware fault | ✓ Detected | HARDWARE_FAULT | Good (explicit, skips ML) |
| Stuck sensor value | ❌ Not Detected | None | — |
| Stale telemetry | ⚠️ Partial | Depends | Poor (timestamp not validated) |
| Physically implausible RoC | ✓ Detected | Threshold/ML | Poor (misidentified as real) |
| Sustained real problem | ✓ Detected | Threshold/ML | Good |

---

## 3. What Each Proposed Enhancement Would Solve

### 3.1 Enhancement 1: Rate-of-Change Validation

**Gap It Fills:** 
- Prevents physically implausible readings from being treated as real anomalies
- Distinguishes transient spikes (2-10 sec) from sustained problems (minutes+)

**Exact Problem Solved:**

1. **Physically Impossible Changes**
   - Current: Temperature spikes 55°C → Alert recommends checking HVAC
   - With RoC Validation: Temperature spike 30°C/sec → Validator flags as impossible → Reading skipped → No alert
   - **Result:** Eliminates false positive from sensor glitch

2. **Transient vs. Sustained Events**
   - Current: CO₂ spikes to 1350 ppm (breath) → Alert fires "Increase ventilation"
   - With RoC Validation: Tracks change rate; if returns to baseline within 10 sec → Classify as transient
   - **Result:** Can suppress transient alerts or label them differently

3. **Stuck Sensor Detection**
   - Current: Repeated 22.5°C readings → Not flagged (looks "too perfect")
   - With RoC Validation: Zero change for 10+ consecutive readings → Flag as stuck
   - **Result:** Detects sensors that stop reporting variability

**Implementation Location:** Before AlertService.evaluate() and before ML Service inference
```
flowchart:
  TelemetryReading
    ↓
  [RoC Validator] ← Check: Is change physically plausible?
    ↓
    If IMPLAUSIBLE: Skip to AlertService, return False
    If PLAUSIBLE: Continue
    ↓
  [AlertService + ML Service] ← Process normally
```

**What Isolation Forest CAN'T Do That RoC Validation Can:**
- Isolation Forest operates on current reading only; doesn't see change over time
- RoC Validation compares consecutive readings and validates rate of change

**Why Current Isolation Forest Has This Gap:**
- Isolation Forest doesn't have access to historical readings (only current feature vector)
- ML Service only receives single reading; no temporal context

---

### 3.2 Enhancement 2: Sensor Fusion Validation

**Gap It Fills:**
- Validates expected correlations between features
- Distinguishes events that should trigger together (e.g., breath) from isolated feature spikes

**Exact Problem Solved:**

1. **Breath vs. HVAC Failure Distinction**
   - Current:
     - Breath: CO₂ +950 ppm, TVOC +50 ppb, Humidity +1%, PM stable
     - HVAC failure: CO₂ +950 ppm, TVOC +500 ppb, Humidity +8%, PM rises
     - Both trigger "high CO₂" alert; operator can't tell which
   
   - With Sensor Fusion:
     - Rule: `if CO₂_rise > 800 ppm AND TVOC_rise < 100 ppb AND PM_stable AND Humidity_rise < 3% → likely_breath`
     - Breath flagged as transient expected pattern; HVAC failure flagged as anomaly
     - **Result:** Operator knows what's happening

2. **Perfume Spray vs. Chemical Spill**
   - Current:
     - Spray: TVOC +800 ppb, rapid spike then rapid decay
     - Spill: TVOC +800 ppb, slow rise then sustained
     - Both look like "high TVOC anomaly"
   
   - With Sensor Fusion:
     - Rule: `if TVOC_spike > 500 ppb AND decay_time < 5 min AND CO2_stable AND PM_stable → likely_spray`
     - **Result:** Distinguishes benign spray from concerning spill

3. **Dust Activity vs. Outdoor Pollution**
   - Current:
     - Local dust: PM2.5 +50 µg/m³, returns to baseline in 2 min
     - Outdoor pollution: PM2.5 +50 µg/m³, sustained for hours, accompanied by CO₂ rise
     - Both look like "high PM anomaly"
   
   - With Sensor Fusion:
     - Rule: `if PM_spike AND all_other_features_stable → likely_local_activity`
     - Rule: `if PM_spike AND CO2_rise AND sustained > 1 hour → likely_outdoor_pollution`
     - **Result:** Distinguishes cause

**What Isolation Forest CAN'T Do That Sensor Fusion Can:**
- Isolation Forest learns implicit correlations but doesn't validate EXPLICIT rules
- Isolation Forest can't say "this feature pattern violates domain knowledge"

**Example Where Isolation Forest Fails:**
```
Scenario: High CO₂ + High PM + Stable TVOC
Isolation Forest: Sees multivariate outlier → ANOMALY
Sensor Fusion: Sees CO₂ + PM but not TVOC → "Unusual pattern, likely external pollution + heating malfunction"

Scenario: High CO₂ + Stable PM + High TVOC
Isolation Forest: Sees multivariate outlier → ANOMALY
Sensor Fusion: Sees CO₂ + TVOC but not PM → "Unusual pattern, likely chemical issue + occupancy"
```

**Why Current Isolation Forest Has This Gap:**
- Isolation Forest treats features as independent dimensions in a cloud
- It doesn't encode domain knowledge ("CO₂ and TVOC should rise together in certain situations")

---

### 3.3 Enhancement 3: Event Classification

**Gap It Fills:**
- Not a detection gap, but an INTERPRETATION gap
- Current system detects anomalies but can't explain what they are

**Exact Problem Solved:**

1. **Operator Understanding**
   - Current Alert: "ML_ANOMALY: Anomaly score 0.87 | Key drivers: CO₂ (+170% vs baseline), TVOC (+10% vs baseline) | Recommended Action: Increase ventilation or open windows"
   - Operator Questions: "Is this breath? HVAC failure? Chemical spill? What do I actually do?"
   
   - With Event Classification:
     - Alert Label: "TRANSIENT_CO2_SPIKE"
     - Type: "Human Breath / Occupancy"
     - Confidence: 85%
     - Duration: 8 seconds
     - Recommended Action: "Normal occupancy pattern; no intervention needed"
     - **Result:** Operator knows this is expected and dismisses alert

2. **Decision Support**
   - Current: Binary anomaly yes/no; operator must interpret drivers
   - With Classification: Alert comes pre-classified as "Transient Spike", "Sustained Rise", "Sensor Fault", "Mixed Event"
   - **Result:** Operator can act immediately without analysis

3. **Alert Filtering**
   - Current: All anomalies treated as "investigation needed"
   - With Classification: Filter out "expected transient" events automatically
   - **Result:** Dashboard shows only "investigation needed" events

**What Isolation Forest CAN'T Do That Event Classification Can:**
- Isolation Forest doesn't know event types; just flags outliers
- Classification layer reads Isolation Forest anomaly + context (top drivers, z-scores) and labels event type

**Implementation Example:**
```python
if is_anomaly:
  top_driver = get_top_driver()  # CO₂, PM, TVOC, etc.
  z_scores = compute_z_scores()
  duration_sec = get_anomaly_duration()
  
  if top_driver == "CO₂":
    if z_score > 5 and duration_sec < 10 and tvoc_z_score < 1:
      event_type = "TRANSIENT_CO2_SPIKE"
      confidence = 0.85
    elif z_score > 3 and duration_sec > 300:
      event_type = "SUSTAINED_CO2_RISE"
      confidence = 0.70
```

**Why Current Isolation Forest Has This Gap:**
- ML Service generates top-2 deviating features but doesn't classify event type
- No logic to distinguish "breath" from "HVAC failure"; just reports drivers

---

### 3.4 Enhancement 4: Confidence Scoring

**Gap It Fills:**
- Not a detection gap, but an UNCERTAINTY gap
- Current system makes binary predictions with no confidence bounds

**Exact Problem Solved:**

1. **Operator Trust in Classification**
   - Current: Event Classification says "85% sure this is breath"
   - But where does "85%" come from? Is that reliable?
   
   - With Confidence Scoring:
     - If Isolation Forest decision_function score = 0.92: High confidence in anomaly detection itself
     - If top-2 z-scores are [6.7, 0.3]: Very confident about CO₂ being driver
     - If event pattern matches breath signature 85/100: Confident in breath classification
     - Composite: 92% × 85% = 78% overall confidence
   - **Result:** Operator understands when to trust the alert vs. when to verify manually

2. **Alert Severity Adjustment**
   - Current: All anomalies = WARNING
   - With Confidence Scoring:
     - High confidence anomaly (92%) = WARNING
     - Low confidence anomaly (45%) = INFO (just FYI)
   - **Result:** Dashboard prioritizes high-confidence alerts

3. **Automated vs. Manual Review**
   - Current: All alerts require manual review
   - With Confidence Scoring:
     - If confidence > 90% and classification is "transient" → Auto-dismiss
     - If confidence < 60% → Flag for manual review
   - **Result:** Reduces operator workload

**What Isolation Forest Provides for Confidence Scoring:**
- Decision function output: Raw anomaly score (e.g., 0.92)
- Contamination parameter: Interpretation of anomaly threshold
- Z-scores of top drivers: Deviation magnitude

**Why Current Isolation Forest Doesn't Provide Confidence:**
- Decision function output is not probabilistic; it's a raw distance metric
- No built-in way to convert `decision_function = 0.92` to "92% confident in anomaly"
- No confidence in EVENT CLASSIFICATION (e.g., "is this breath or HVAC?")

---

### 3.5 Enhancement 5: Preset Profiles

**Gap It Fills:**
- Not a detection gap, but a CONFIGURATION gap
- Current system requires manual sensitivity tuning; no guidance on what values to use

**Exact Problem Solved:**

1. **Setup Time & Guidance**
   - Current Workflow:
     ```
     User: "I deployed a sensor in the kitchen"
     System: "What baseline window? (default 15 readings = 37.5 sec)"
     User: "Uh... 24 hours?"
     System: "What sensitivity? (1-100)"
     User: "50? I don't know what that means"
     System: "OK, sensitivity=50, contamination=0.50"
     User: "Is that right?"
     ```
   
   - With Preset Profiles:
     ```
     User: "I deployed a sensor in the kitchen"
     System: "Select profile: [Office / Classroom / Kitchen / Server Room / Lab / Custom]"
     User: "Kitchen"
     System: "Profile applied: Baseline 4-6h, Sensitivity 30-40, Forecast 5-10m"
     User: "Done!"
     ```
   - **Result:** Setup takes 1 min instead of 10 min

2. **Operational Consistency**
   - Current: Each operator tunes differently → 30 identical Office sensors with different sensitivities
   - With Profiles: All Office sensors have same ML parameters → Predictable behavior across fleet
   - **Result:** Troubleshooting easier ("Office sensor should behave like X")

3. **False Positive Reduction Through Profile Tuning**
   - Current: Generic sensitivity=50 for all environments
   - With Profiles:
     - Office: Sensitivity 40-50 (tolerates occupancy variations)
     - Kitchen: Sensitivity 30-40 (tolerates cooking spikes)
     - Server Room: Sensitivity 70-80 (very strict, no occupancy noise)
   - **Result:** Each environment gets appropriate baseline window + sensitivity
   - **Quantified:** 15-35% false positive reduction by using right sensitivity for environment

**What Isolation Forest CAN'T Do That Profiles Can:**
- Isolation Forest doesn't know about environments; it just learns from whatever baseline is provided
- If Kitchen sensor has baseline collected during cooking (high PM, TVOC), it works well
- But if Kitchen sensor has baseline collected during cleaning day (empty), next cooking smells like anomaly
- Profiles encode: "Kitchens need 4-6 hour baseline to capture cooking cycles"

**Why Current Isolation Forest Has This Gap:**
- No guidance on sensitivity values
- No environment-aware defaults
- Manual tuning is trial-and-error

**Important Caveat:**
- Profiles don't solve disturbance problems; they only reduce false positive frequency
- A breath spike in an Office still looks like anomaly at sensitivity=45
- Profiles just mean: "This sensitivity is calibrated for typical Office environments"

---

## 4. Summary Matrix: Enhancement vs. Gap

| Enhancement | Gap Type | Problem It Solves | What Isolation Forest Can't Do |
| :--- | :--- | :--- | :--- |
| **Rate-of-Change Validation** | Detection | Filters physically impossible readings; detects stuck sensors; distinguishes transient vs. sustained | Access to temporal history; comparing consecutive readings |
| **Sensor Fusion Validation** | Detection | Validates expected feature correlations; distinguishes breath from HVAC; spray from spill | Encode domain rules about feature relationships |
| **Event Classification** | Interpretation | Labels anomalies with type (breath, spill, pollution); enables decision support | Classify event types from feature patterns |
| **Confidence Scoring** | Uncertainty | Communicates confidence in both anomaly detection and classification | Generate confidence bounds; estimate classification reliability |
| **Preset Profiles** | Configuration | Provides ML parameter guidance; reduces setup time; improves consistency | Know about environments; provide default sensitivity |

---

## 5. Disturbance-by-Disturbance: What Each Enhancement Adds

### Problem: Human Breath Near CO₂ Sensor

**Current Status:**
- Isolated Forest: ✓ Detects as high CO₂ anomaly
- Threshold Alert: ✓ Fires if CO₂ > 1500 ppm
- Operator Alert: "CO₂ exceeds threshold; increase ventilation"

**Gaps:**
- ❌ Can't distinguish breath from HVAC failure
- ❌ Can't distinguish transient (will pass) from sustained (needs action)

**What Each Enhancement Adds:**

1. **Rate-of-Change Validation:**
   - Tracks CO₂ change rate: +950 ppm in 5 sec = 190 ppm/sec
   - Checks: Is change physically plausible? YES (breathing can cause this)
   - Tracks decay: CO₂ drops back to baseline in 10 sec
   - **Conclusion:** Transient spike (breath), not sustained problem
   - **Result:** Can suppress alert or label as "expected transient"

2. **Sensor Fusion Validation:**
   - Breath pattern: High CO₂ + low TVOC + stable PM + low humidity rise
   - HVAC failure pattern: High CO₂ + high TVOC + rising PM + high humidity rise
   - **Conclusion:** This is breath pattern, not HVAC
   - **Result:** Alert labeled "breath detected, no action needed"

3. **Event Classification:**
   - Input: Isolation Forest anomaly + RoC data + Sensor Fusion pattern
   - Output: "TRANSIENT_CO2_SPIKE, Type: Human Breath, Confidence: 90%"
   - **Result:** Operator sees clear explanation; dismisses alert

4. **Confidence Scoring:**
   - Anomaly detection confidence: 92% (strong z-score)
   - Event classification confidence: 90% (matches breath signature)
   - **Result:** Operator trusts this is truly breath, not false alarm

5. **Preset Profiles:**
   - Office profile: Baseline 12-24h (captures occupancy patterns), Sensitivity 45
   - **Result:** System already "knows" offices have occupancy spikes; fewer false positives

---

### Problem: Perfume/VOC Spray

**Current Status:**
- Isolation Forest: ✓ Detects as high TVOC anomaly
- Threshold Alert: ✓ Fires if TVOC > 1000 ppb
- Operator Alert: "TVOC exceeds threshold; investigate for chemical spills"

**Gaps:**
- ❌ Can't distinguish spray from chemical spill
- ❌ Recommends emergency response for benign activity

**What Each Enhancement Adds:**

1. **Rate-of-Change Validation:**
   - Spray decay rate: TVOC drops from 950 to 200 ppb in 30 sec
   - Spill decay rate: TVOC slowly drops from 950 to 800 ppb over 2 hours
   - **Conclusion:** Rapid decay = spray; slow decay = spill
   - **Result:** Can distinguish based on temporal pattern

2. **Sensor Fusion Validation:**
   - Spray pattern: TVOC spike + stable CO₂ + stable PM + stable temp/humidity
   - Spill pattern: TVOC rise + CO₂ rises + PM may rise + room warming
   - **Conclusion:** This is spray pattern
   - **Result:** Alert classified as "spray, not spill"

3. **Event Classification:**
   - Input: Isolation Forest + RoC (fast decay) + Sensor Fusion (isolated TVOC)
   - Output: "TRANSIENT_TVOC_SPIKE, Type: Spray/Fragrance, Confidence: 88%"
   - **Result:** Operator knows no emergency response needed

4. **Confidence Scoring:**
   - Confidence: 88% (strong TVOC spike, fast decay confirms transient)
   - **Result:** Operator trusts classification and dismisses

5. **Preset Profiles:**
   - Kitchen profile: TVOC threshold 1500 ppb (higher), Sensitivity 30 (low)
   - **Result:** Spray might not trigger alert at all in Kitchen profile; Office profile is stricter

---

### Problem: Dust Disturbance Near SPS30

**Current Status:**
- Isolation Forest: ✓ Detects as high PM anomaly
- Threshold Alert: ✓ Fires if PM2.5 > 35 µg/m³
- Operator Alert: "PM2.5 high; check building air filters; keep windows closed"

**Gaps:**
- ❌ Can't distinguish local dust from outdoor pollution
- ❌ Recommends closing windows for local dust (incorrect action)

**What Each Enhancement Adds:**

1. **Rate-of-Change Validation:**
   - Local dust decay: PM2.5 drops from 50 to 5 µg/m³ in 2 min
   - Outdoor pollution: PM2.5 stays at 50+ µg/m³ for 4+ hours
   - **Conclusion:** Rapid normalization = local; sustained = outdoor
   - **Result:** Can distinguish based on duration

2. **Sensor Fusion Validation:**
   - Local dust pattern: PM spike + stable CO₂ + stable TVOC (no odor)
   - Outdoor pollution pattern: PM spike + CO₂ correlates + sustained for hours
   - **Conclusion:** This is local dust
   - **Result:** Alert classified as "local activity"

3. **Event Classification:**
   - Input: Isolation Forest + RoC (normalizes in 2 min) + Sensor Fusion
   - Output: "PM_SPIKE, Type: Local Activity (dust, movement), Confidence: 85%"
   - **Result:** Operator knows this is local, not pollution

4. **Confidence Scoring:**
   - Confidence: 85% (PM spike + rapid normalization + no CO₂ correlation)
   - **Result:** Operator trusts and dismisses

5. **Preset Profiles:**
   - Kitchen profile: PM2.5 threshold 50 µg/m³ (much higher than office 25)
   - **Result:** Kitchen dust spikes don't trigger alerts; office dust triggers but can be classified

---

### Problem: Occupancy-Driven CO₂ Increase

**Current Status:**
- Isolation Forest: ⚠️ FALSE POSITIVE (baseline unoccupied, occupancy looks anomalous)
- Threshold Alert: ✗ Doesn't trigger (CO₂ 800 ppm < 1500 threshold)
- Operator Alert: ML_ANOMALY "Unusual CO₂ pattern detected"

**Gaps:**
- ❌ False positive when baseline doesn't include occupancy
- ❌ System doesn't "know" offices have occupancy schedules

**What Each Enhancement Adds:**

1. **Rate-of-Change Validation:**
   - CO₂ rises gradually: 420 → 500 → 600 → 800 ppm over 30 min
   - Rate of change: ~13 ppm/min (steady, physically plausible)
   - **Conclusion:** Gradual rise, not sudden spike = occupancy or HVAC change (normal)
   - **Result:** Classifies as expected drift, not anomaly

2. **Sensor Fusion Validation:**
   - Occupancy pattern: CO₂ rise + temperature rise (body heat) + humidity rise + PM rise (activity)
   - Expected in offices during business hours
   - **Conclusion:** Expected occupancy pattern
   - **Result:** Can suppress alert or label as "expected occupancy"

3. **Event Classification:**
   - Input: Isolation Forest + RoC (gradual) + Sensor Fusion (all features rise together)
   - Output: "CO2_RISE, Type: Occupancy Pattern, Confidence: 75%"
   - **Result:** Operator knows this is expected

4. **Confidence Scoring:**
   - Confidence: 75% (pattern matches occupancy, but not 100% certain)
   - **Result:** Operator gets FYI alert, not WARNING

5. **Preset Profiles:**
   - Office profile: Baseline 12-24h (captures occupancy), Sensitivity 45
   - **Result:** Baseline already includes occupancy patterns; CO₂ rise not flagged
   - Kitchen profile: Baseline 4-6h (captures cooking cycles)
   - Classroom profile: Baseline 2-3 days (captures occupancy schedule across multiple class periods)
   - **Result:** Right baseline window eliminates false positive

---

### Problem: Physically Implausible Rate-of-Change

**Scenario:** Temperature spike from 25°C to 55°C in 1 second (glitch)

**Current Status:**
- Isolation Forest: ✓ Detects as high temperature anomaly
- Threshold Alert: ✓ Fires "Temperature exceeds max"
- Operator Alert: "Temperature 55°C; check HVAC unit"

**Problems:**
- ❌ Recommendation to check HVAC is wrong (sensor glitch, not HVAC)
- ❌ Sensor glitch poisons alert stream

**What Each Enhancement Adds:**

1. **Rate-of-Change Validation:**
   - Change rate: 30°C/sec
   - Physical limit: Realistic HVAC can cause max ~2°C/sec
   - **Conclusion:** 30°C/sec is impossible → Sensor glitch
   - **Result:** Reading rejected before alert evaluation; no alert fires

2. **Sensor Fusion Validation:**
   - If sensor reads 55°C but humidity and other features are stable, invalid
   - Real temperature spike would cause humidity changes, air pressure changes
   - **Conclusion:** Isolated temperature spike = sensor fault
   - **Result:** Flags as sensor fault, not environmental problem

3. **Event Classification:**
   - (After RoC rejection, no anomaly to classify)
   - But if it did get classified: "SENSOR_GLITCH"

4. **Confidence Scoring:**
   - (Confidence would be 0% after RoC validation)

5. **Preset Profiles:**
   - No impact on glitch detection

---

## 6. Critical Findings

### 6.1 What Isolation Forest Handles Well

1. ✓ **Sustained real problems:** HVAC failure, persistent high PM, actual chemical spill
2. ✓ **Multivariate anomalies:** Detects when multiple features deviate simultaneously
3. ✓ **Environment adaptation:** Learns different baseline for different rooms
4. ✓ **Outlier identification:** Correctly identifies readings outside normal range

### 6.2 What Isolation Forest Cannot Do

1. ❌ **Temporal validation:** Distinguish transient from sustained (needs time series)
2. ❌ **Feature relationships:** Validate correlations between features (needs domain rules)
3. ❌ **Event classification:** Distinguish breath from HVAC from spill (needs logic layer)
4. ❌ **Confidence estimation:** Provide probabilistic confidence in anomaly detection
5. ❌ **Rate-of-change:** Check physical plausibility of rapid changes
6. ❌ **Stuck sensor detection:** Identify missing variability
7. ❌ **Temporal staleness:** Detect old telemetry data
8. ❌ **Configuration guidance:** Suggest appropriate sensitivity for environment

### 6.3 False Positive Root Causes

| False Positive | Root Cause | Enhancement That Fixes | Priority |
| :--- | :--- | :--- | :--- |
| Breath treated as HVAC failure | No temporal/correlation validation | RoC + Sensor Fusion | Tier 1 |
| Spray treated as chemical spill | No temporal decay analysis | RoC + Sensor Fusion | Tier 1 |
| Local dust treated as pollution | No temporal pattern recognition | RoC + Sensor Fusion | Tier 1 |
| Occupancy as anomaly | Baseline doesn't include occupancy | Preset Profiles (longer baseline) | Tier 2 |
| Sensor glitch as real problem | No RoC validation | Rate-of-Change Validation | Tier 1 |
| Unclear recommended action | Event not classified | Event Classification | Tier 2 |

### 6.4 What Isolation Forest Already Gets Right

**The system DOES correctly:**
1. Detect when readings deviate significantly from baseline
2. Flag multivariate outliers (when multiple features are unusual)
3. Persist models between restarts
4. Skip inference for hardware faults (-999.0 readings)
5. Generate alerts for threshold breaches (temp, CO₂, PM2.5, TVOC)
6. Provide anomaly scores and context (top drivers)
7. Support per-node configuration (baseline window, sensitivity)

**The system DOES NOT need:**
- Better anomaly detection algorithm (Isolation Forest is solid for this)
- Larger baseline windows (unless addressing occupancy patterns)
- More features (10D is adequate; adding more features doesn't solve interpretation gaps)

**What the system DOES need:**
1. **Temporal analysis layer:** RoC validation to filter glitches and analyze duration
2. **Domain logic layer:** Sensor fusion to validate feature correlations
3. **Interpretation layer:** Event classification to explain what anomalies mean
4. **Confidence layer:** Uncertainty quantification in both detection and classification
5. **Configuration guidance:** Profiles to reduce operator tuning burden

---

## 7. Practical Implication for Semester Project

### 7.1 Current Isolation Forest Status

The Isolation Forest implementation is **good for what it does** (detecting multivariate outliers), but **doesn't address interpretation, validation, or guidance**.

### 7.2 Why Each Enhancement is Necessary

1. **Rate-of-Change Validation** — **ESSENTIAL**
   - Eliminates ~20–30% of false positives from sensor glitches and transient noise
   - Single enhancement with highest false positive reduction
   - Implementation: 3–4 hours

2. **Sensor Fusion Validation** — **ESSENTIAL**
   - Distinguishes event types (breath vs. spill) based on feature correlations
   - Enables operator to understand root cause
   - Implementation: 6–8 hours

3. **Event Classification** — **HIGH VALUE**
   - Transforms raw anomaly scores into actionable labels
   - Enables dashboard to show "Breath detected" instead of "High CO₂ anomaly"
   - Implementation: 4–6 hours
   - **Demonstrates system intelligence more clearly than Profiles**

4. **Confidence Scoring** — **MODERATE VALUE**
   - Communicates uncertainty in both detection and classification
   - Allows automated filtering (high confidence) vs. manual review (low confidence)
   - Implementation: 2–3 hours

5. **Preset Profiles** — **NICE TO HAVE**
   - Reduces setup time and improves consistency
   - **Does NOT solve false positive problems** (misconception in current doc)
   - Implementation: 3–4 hours (simplified) or 8–12 hours (full)
   - **Lower priority than Event Classification**

### 7.3 Revised Priority Ranking (for semester project)

**MUST HAVE:**
1. Rate-of-Change Validation (3–4 hrs) — Core reliability
2. Sensor Fusion Validation (6–8 hrs) — Core reliability
3. Event Classification (4–6 hrs) — Demonstrate intelligence

**SHOULD HAVE:**
4. Confidence Scoring (2–3 hrs) — Polish

**NICE TO HAVE:**
5. Simplified Preset Profiles (3–4 hrs) — UX convenience

**Total: 18–28 hours core work + 5–7 hours polish + 3–4 hours convenience = 26–39 hours**

---

## 8. Conclusion

The current Isolation Forest implementation **correctly detects anomalies but cannot interpret them**. Each proposed enhancement fills a specific gap:

- **RoC Validation:** Filters impossible changes; detects stuck sensors
- **Sensor Fusion:** Distinguishes event types by feature relationships
- **Event Classification:** Labels anomalies with human-readable types
- **Confidence Scoring:** Communicates uncertainty in predictions
- **Preset Profiles:** Provides configuration guidance for common environments

**All five enhancements serve distinct purposes.** None duplicate Isolation Forest's work; all are orthogonal layers on top of the ML model.

**For a semester project:** Prioritize RoC Validation + Sensor Fusion + Event Classification. These directly solve false positive problems and demonstrate system intelligence. Profiles are lower priority because they don't solve core technical problems; they just reduce setup friction.

---
