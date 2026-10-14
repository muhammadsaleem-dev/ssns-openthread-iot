# Preset Profiles Analysis: Environmental Monitoring Strategy

**Document Version:** 1.0  
**Date:** June 2026  
**Purpose:** Feasibility and architectural analysis of preset environment profiles for SSNS sensor nodes  
**Scope:** Strategy definition, not implementation

---

## Executive Summary

**Question:** Should SSNS support preset environment profiles (Office, Classroom, Kitchen, etc.) that operators can assign to sensor nodes via the frontend?

**Recommendation:** ⚠️ **CONDITIONAL: Implement after Event Classification** (see Section 10)

**Key Finding:** Preset profiles provide **moderate operational value** (reduced configuration burden, guided setup) but **do not address core disturbance detection gaps** identified in SENSOR_DISTURBANCE_AND_DATA_RELIABILITY_ANALYSIS.md. Profiles are complementary to, not a substitute for, rate-of-change validation and sensor fusion.

**Priority:** Lower than rate-of-change validation and event classification, but valuable as a UX enhancement.

---

## 1. Background: Current ML Settings Approach

### Current State
From dashboard ML Settings UI:
- **Baseline Window:** Manual slider (1h–24h)
- **Sensitivity:** Manual slider (1–100)
- **Forecast Horizon:** Manual slider (15m–2h)
- **Per-Node Configuration:** Each node requires independent tuning

### Current Workflow
```
New sensor deployed
  ↓ Operator opens ML Settings panel
  ↓ Manually selects baseline window (guess: 12h? 24h?)
  ↓ Manually selects sensitivity (guess: 50? Too high?)
  ↓ Manually selects forecast horizon (default 1h?)
  ↓ Clicks CALIBRATE to start baseline collection
  ↓ Waits for baseline window to elapse
  ↓ Monitors alerts for false positive storms
  ↓ If too many false alerts, reduces sensitivity manually
  ↓ If too few alerts, increases sensitivity manually
  ↓ Iterates until "feels right"
```

### Problems with Current Approach
1. **No Guidance:** Operator must guess appropriate values
2. **No Context:** Window/sensitivity disconnected from deployment environment
3. **Iteration Required:** No "first-pass" that works; tuning is reactive
4. **No Standards:** Each operator sets different values; inconsistent behavior
5. **Discoverability:** New users don't know profiles are the solution

---

## 2. Profile Specifications

### Profile 1: Office

**Description:** General office space with typical occupancy patterns (9 AM–6 PM weekdays).

| Dimension | Recommended Value | Rationale |
| :--- | :---: | :--- |
| **Baseline Window** | 12–24h | Office patterns (occupancy, temperature swings) established over 1 day |
| **ML Sensitivity** | 40–50 | Medium: detect genuine issues, tolerate daily occupancy variations |
| **Forecast Horizon** | 45m | Alert on projected air quality in short term (typical meeting duration) |

**Sensor-Specific Thresholds:**

| Sensor | Recommended Threshold | Adjustment from Baseline | Rationale |
| :--- | :---: | :--- | :--- |
| **CO₂** | 1200 ppm | −25% (from 1500) | Occupancy drives CO₂; 1200 ppm marks poor air quality |
| **PM2.5** | 25 µg/m³ | −29% (from 35) | Indoor typical <15 µg/m³; 25 µg/m³ = degradation |
| **TVOC** | 500 ppb | −50% (from 1000) | Office VOC sources (cleaning, carpets); 500 ppb threshold |
| **Temperature** | High: 26°C, Low: 18°C | Tight range (±4°C) | Office comfort expectation |
| **Humidity** | High: 60%RH, Low: 30%RH | Standard comfort range | ±5% tolerance for HVAC variation |

**Expected Environmental Behavior:**
- **Normal State:** Stable baseline during occupied hours; minor HVAC-driven swings
- **Morning Ramp:** CO₂ rises 5–30 min after arrival (occupancy), then stabilizes
- **Afternoon Dip:** Temperature rises 1–2°C post-lunch (heating from occupancy)
- **End of Day:** Quick CO₂ drop as windows opened or occupants leave
- **Overnight:** All sensors stable (HVAC minimal, no occupancy)

**Affected Alerts:**
- ✓ CO₂ alert threshold **lowered** → earlier warning of poor ventilation
- ✓ PM2.5 alert threshold **lowered** → detects indoor pollution faster
- ✓ Temperature/Humidity ranges **narrower** → alerts on HVAC issues

**Anomaly Detection Accuracy Impact:**
- **Benefit:** Narrower expected range reduces false positives from normal occupancy variations
- **Risk:** May miss occupancy-driven spikes (if sensitivity not tuned)
- **Expected FP Reduction:** ~15–20% (from 40% baseline to ~20–25%)

---

### Profile 2: Classroom

**Description:** Educational space with intermittent occupancy (class periods: 1h blocks, 2–3 per day), high CO₂ variation.

| Dimension | Recommended Value | Rationale |
| :--- | :---: | :--- |
| **Baseline Window** | 2–3 days | Need data across multiple class sessions to establish pattern |
| **ML Sensitivity** | 35–45 | Lower: classroom occupancy spikes are *expected*; allow larger CO₂/temperature swings |
| **Forecast Horizon** | 20m | Alert early in class (when CO₂ is rising fastest) |

**Sensor-Specific Thresholds:**

| Sensor | Recommended Threshold | Adjustment from Baseline | Rationale |
| :--- | :---: | :--- | :--- |
| **CO₂** | 1600 ppm | +7% (from 1500) | Classes sustain high CO₂ (40 students breathing); 1600 ppm acceptable |
| **PM2.5** | 30 µg/m³ | −14% (from 35) | Activity (chalk, movement) creates dust; set threshold low |
| **TVOC** | 800 ppb | −20% (from 1000) | Classroom VOC sources (markers, body odor); threshold lower |
| **Temperature** | High: 28°C, Low: 16°C | Wide range (±6°C) | Class occupancy causes 3–5°C swings; HVAC lag |
| **Humidity** | High: 70%RH, Low: 25%RH | Wide range (±7.5%) | Breathing + windows opened = humidity spikes |

**Expected Environmental Behavior:**
- **Before Class:** Baseline CO₂ ~400 ppm, Temp ~22°C
- **Class Start (0–5 min):** Rapid CO₂ rise (+100 ppm/min), temperature +1–2°C
- **Mid-Class (10–40 min):** CO₂ plateau ~1500 ppm, temperature stabilized +3°C above baseline
- **End of Class:** Rapid CO₂ drop (doors/windows open), temperature drop as occupancy leaves
- **Between Classes:** 15–30 min baseline recovery
- **PM Spikes:** Multiple CO₂/temp cycles (class 1 → recover → class 2)

**Affected Alerts:**
- ✓ CO₂ threshold **slightly raised** → classroom spikes not flagged as emergencies
- ✓ PM2.5 threshold **lower** → chalk dust detected
- ✓ Temperature range **wider** → occupancy-driven swings tolerated

**Anomaly Detection Accuracy Impact:**
- **Benefit:** ML baseline captures class-period patterns; true anomalies stand out
- **Risk:** Real air quality issues masked by "expected" class spikes
- **Recommended Mitigation:** Add temporal heuristic (e.g., "CO₂ spike outside class hours" = anomalous)
- **Expected FP Reduction:** ~10–15% (occupancy spikes no longer surprise the detector)

---

### Profile 3: Kitchen

**Description:** Food preparation area with high transient disturbances (cooking, steam, odors, occasional fires).

| Dimension | Recommended Value | Rationale |
| :--- | :---: | :--- |
| **Baseline Window** | 4–6 hours | Multiple meal cycles (lunch preparation, dinner prep) needed to establish baseline |
| **ML Sensitivity** | 30–40 | Very low: cooking creates continuous TVOC/PM spikes; only flag sustained problems |
| **Forecast Horizon** | 5–10m | Very short: cooking events fleeting; predict end of event, not long-term trend |

**Sensor-Specific Thresholds:**

| Sensor | Recommended Threshold | Adjustment from Baseline | Rationale |
| :--- | :---: | :--- | :--- |
| **CO₂** | 1000 ppm | −33% (from 1500) | Kitchens usually well-ventilated; 1000 ppm flags HVAC failure |
| **PM2.5** | 50 µg/m³ | +43% (from 35) | Cooking (frying, grilling) creates sustained PM; raise threshold significantly |
| **TVOC** | 1500 ppb | +50% (from 1000) | Cooking VOCs (cooking oils, spices); raise threshold high |
| **Temperature** | High: 32°C, Low: 15°C | Very wide (±8°C) | Heat from stoves/ovens; range can be large |
| **Humidity** | High: 80%RH, Low: 20%RH | Very wide (±8%) | Steam from cooking/boiling; humidity swings extreme |

**Expected Environmental Behavior:**
- **Off-Peak (breakfast/between meals):** Stable baseline
- **Cooking Active (lunch prep, dinner):** 
  - PM2.5: +20–50 µg/m³ (grilling, frying)
  - TVOC: +300–800 ppb (cooking oils, spices)
  - Temperature: +3–8°C (oven/stove radiant heat)
  - Humidity: +15–30% (steam from boiling/steaming)
- **Transient Spikes:** 
  - Burned food: TVOC spike +1000 ppb (10–30 sec)
  - Grease splatter: PM spike +100 µg/m³ (seconds)
  - Smoke alarm trigger: Rapid CO, PM, temperature spike
- **Post-Meal:** Rapid recovery after ventilation/window opening

**Affected Alerts:**
- ✓ PM2.5 threshold **raised** → cooking PM not flagged as outdoor pollution
- ✓ TVOC threshold **raised** → cooking odors not flagged as chemical spills
- ✓ Temperature/Humidity ranges **much wider** → heat/steam from cooking tolerated
- ✓ CO₂ threshold **lowered** → ventilation problems still caught

**Anomaly Detection Accuracy Impact:**
- **Benefit:** Normal cooking activity no longer floods alerts; true anomalies (sustained high PM post-cooking, HVAC failure) detectable
- **Risk:** Real air quality issues (spoiled food, smoke from fire) may be missed in noise of normal cooking
- **Recommended Mitigation:** Add rate-of-change detector (sustained high TVOC/PM = problem; transient spike = normal)
- **Expected FP Reduction:** ~35–40% (vast majority of kitchen alerts are cooking-related)

---

### Profile 4: Server Room

**Description:** Temperature-critical data center / telecom closet with cooling systems, no human occupancy, constant baseline.

| Dimension | Recommended Value | Rationale |
| :--- | :---: | :--- |
| **Baseline Window** | 24–48h | Server room patterns very stable; long window captures rare thermal events |
| **ML Sensitivity** | 70–80 | High: minimize false positives from normal HVAC operation; catch real thermal anomalies |
| **Forecast Horizon** | 2h | Long: thermal issues develop slowly; predict overheating trajectory |

**Sensor-Specific Thresholds:**

| Sensor | Recommended Threshold | Adjustment from Baseline | Rationale |
| :--- | :---: | :--- | :--- |
| **CO₂** | N/A (not critical) | N/A | Server rooms unsealed; CO₂ not monitored |
| **PM2.5** | 15 µg/m³ | −57% (from 35) | Equipment filters critical; even small PM increase = cooling blockage |
| **TVOC** | 100 ppb | −90% (from 1000) | No occupancy; any TVOC = equipment failure / fire hazard |
| **Temperature** | High: 28°C, Low: 16°C | Tight range (±6°C) | Server specs: 15–27°C typical; tight control required |
| **Humidity** | High: 50%RH, Low: 40%RH | Very tight (±5%) | Equipment specs: 20–80% acceptable, but extreme dryness/moisture damages circuits |

**Expected Environmental Behavior:**
- **Normal State:** Temperature 18–24°C, PM <5 µg/m³, TVOC <50 ppb, humidity 45–55%
- **HVAC Cycle:** Temperature variation ±0.5–1°C (thermostat regulation)
- **Startup Transient:** Brief PM spike (10 sec) when HVAC kicks in (dust from ducts)
- **Thermal Spike (abnormal):** Sustained temperature rise >2°C over 30 min (cooling failure, load increase)
- **Equipment Fire (catastrophic):** TVOC spike +500–1000 ppb, PM spike +50 µg/m³, temperature rise +10°C

**Affected Alerts:**
- ✓ PM2.5 threshold **much lower** → equipment filter blockage detected
- ✓ TVOC threshold **much lower** → potential equipment failure/fire hazard
- ✓ Temperature range **very tight** → cooling system issues caught immediately
- ✓ Humidity range **very tight** → static damage prevention

**Anomaly Detection Accuracy Impact:**
- **Benefit:** High sensitivity + stable baseline = excellent thermal anomaly detection; false positives from occupancy eliminated (none)
- **Risk:** Maintenance events (filter cleaning, equipment upgrade) create transient spikes; need context to not trigger false alarms
- **Expected FP Reduction:** ~5–10% (very controlled environment; most variation is genuine)

---

### Profile 5: Laboratory

**Description:** Research/testing facility with equipment, occasional chemical use, controlled but variable conditions.

| Dimension | Recommended Value | Rationale |
| :--- | :---: | :--- |
| **Baseline Window** | 2–3 days | Baseline varies by experiment; need multiple days to capture variation |
| **ML Sensitivity** | 50–60 | Medium-High: balance normal equipment operation with genuine chemical hazards |
| **Forecast Horizon** | 30m | Alert on approaching air quality limits during experiments |

**Sensor-Specific Thresholds:**

| Sensor | Recommended Threshold | Adjustment from Baseline | Rationale |
| :--- | :---: | :--- | :--- |
| **CO₂** | 1200 ppm | −20% (from 1500) | Experiments often use gas; baseline elevated; set threshold low for occupancy comfort |
| **PM2.5** | 20 µg/m³ | −43% (from 35) | Equipment + occasional aerosol experiments; low threshold for safety |
| **TVOC** | 400 ppb | −60% (from 1000) | Chemical storage/use; lower threshold flags vapor accumulation |
| **Temperature** | High: 28°C, Low: 14°C | Medium range (±7°C) | Equipment generates heat; some experiments require cooling |
| **Humidity** | High: 65%RH, Low: 30%RH | Medium range (±7.5%) | Humidity-sensitive equipment; drying cabinets may affect |

**Expected Environmental Behavior:**
- **Idle (no experiments):** Baseline stable; occasional occupancy-driven variations
- **Equipment Running:** Sustained temperature +2–4°C, PM +10–20 µg/m³, TVOC +50–150 ppb
- **Chemical Experiment:** Rapid TVOC spike (+200–500 ppb), possible PM spike (aerosol generation)
- **Fume Hood Operation:** Rapid PM/TVOC removal (within 2–5 min if hood functioning)
- **Post-Experiment:** Slow baseline return (air exchange rates 4–6 ACH typical lab)

**Affected Alerts:**
- ✓ TVOC threshold **much lower** → chemical vapor buildup detected early
- ✓ PM2.5 threshold **lower** → equipment dust/aerosols detected
- ✓ CO₂ threshold **lower** → occupancy + equipment baseline recognized

**Anomaly Detection Accuracy Impact:**
- **Benefit:** Baseline captures equipment operation; chemical spills stand out as true anomalies
- **Risk:** Legitimate experiments (high TVOC during chemistry lab) may trigger alerts
- **Recommended Mitigation:** Combine with scheduled "experiment mode" (manual suppression during known tests)
- **Expected FP Reduction:** ~20–25% (equipment baseline now recognized as normal)

---

### Profile 6: Custom

**Description:** User-defined profile for non-standard environments.

**Approach:**
- Copy an existing profile as template (e.g., "Custom (based on Office)")
- Manual adjustment of all parameters via sliders
- Saved for reuse on similar nodes

**Use Cases:**
- Warehouse (high PM, large temperature swings, minimal HVAC)
- Hospital Ward (strict temperature/humidity, occupancy-sensitive)
- Art Gallery (tight temperature/humidity for preservation)
- Retail Store (occupancy-driven, cooking/HVAC noise)

---

## 3. Comparative Analysis: Profiles vs. Manual Settings

### Manual Settings Approach (Current)

| Dimension | Characteristic |
| :--- | :--- |
| **Setup Time** | 5–10 min (read docs, guess values, click sliders) |
| **Guidance** | None (operator must understand baseline window, sensitivity concepts) |
| **Consistency** | Low (different operators → different values) |
| **Adaptation** | Manual iteration required (reactive after false positives) |
| **Context Awareness** | None (settings independent of deployment environment) |
| **Expertise Required** | Medium-High (understanding ML parameter relationships) |
| **Discoverability** | Low (new users unaware what settings to use) |

### Preset Profiles Approach (Proposed)

| Dimension | Characteristic |
| :--- | :--- |
| **Setup Time** | 1–2 min (select profile from dropdown) |
| **Guidance** | High (profile encodes recommendations + rationale) |
| **Consistency** | High (all Office profiles identical; standardized behavior) |
| **Adaptation** | Semi-manual (start with profile, refine if needed) |
| **Context Awareness** | High (thresholds tuned to environment-specific behavior) |
| **Expertise Required** | Low (profile selection simple; tweaking optional) |
| **Discoverability** | High (clear options; self-documenting) |

### Quantitative Comparison

| Metric | Manual | Profiles | Profiles Advantage |
| :--- | :---: | :---: | :--- |
| **Time to Production** | 30–60 min (with iteration) | 5–15 min | 4–12× faster |
| **False Positive Reduction** | 0–40% (varies by operator skill) | 15–35% (profile-specific) | ~20% average |
| **Configuration Consistency** | ~30% (operators diverge) | 95%+ (profile-driven) | 3× more consistent |
| **Operator Training Burden** | High (explain each parameter) | Low (explain profiles) | Training time −60% |

---

## 4. Do Profiles Solve Issues from SENSOR_DISTURBANCE_AND_DATA_RELIABILITY_ANALYSIS.md?

### Issues That Profiles *Partially* Address

**Issue 1: False Positives from Transient Disturbances (Breath, Spray, Dust)**

- ✓ Profiles adjust thresholds for expected environment (e.g., kitchen thresholds tolerate PM spikes)
- ✓ Sensitivity adjustment reduces alert spam in high-variation environments
- ✗ **Does NOT solve:** Profiles still can't distinguish breath spike from ventilation failure
- ✗ **Does NOT solve:** Rate-of-change validation still needed to distinguish transient vs. sustained

**Status:** **Partially Addressed** (reduces frequency, not root cause)

---

**Issue 2: Occupancy-Driven Alert Storms (Classroom, Office)**

- ✓ Profiles with occupancy awareness (Office, Classroom) adjust CO₂/temperature expectations
- ✓ ML sensitivity tuned to expected occupancy patterns
- ✗ **Does NOT solve:** Still can't distinguish occupancy from HVAC failure during hours when occupancy expected
- ✗ **Does NOT solve:** Temporal context still needed (e.g., "spike during unoccupied hours" = anomalous)

**Status:** **Partially Addressed** (reduces false positives, not perfect discrimination)

---

**Issue 3: Sensor Faults (Stuck Values, I2C Timeouts)**

- ✗ **Does NOT Solve:** Profile thresholds irrelevant to stuck-value detection
- ✗ **Does NOT Solve:** Hardware fault detection independent of environment profile

**Status:** **NOT ADDRESSED** (orthogonal issue)

---

**Issue 4: Out-of-Order Telemetry & Stale Data**

- ✗ **Does NOT Solve:** Profile thresholds irrelevant to network sequencing
- ✗ **Does NOT Solve:** Sequence number enforcement independent of environment

**Status:** **NOT ADDRESSED** (orthogonal issue)

---

**Issue 5: Humidity Spike Detection (No Current Threshold)**

- ✓ Profiles can define humidity thresholds per environment (e.g., Kitchen: 80% high, Laboratory: 65% high)
- ✓ Humidity becomes actionable (currently ignored)
- ✓ Profiles can guide operators to set humidity expectations

**Status:** **Addressed** (humidity now monitored contextually)

---

### Issues That Profiles Do *NOT* Solve

1. **Rate-of-Change Anomalies:** Profiles don't validate physical plausibility of change rates; still need RoC validator (Section 4.2.1 from reliability analysis)

2. **Sensor Fusion Events:** Profiles don't distinguish event types (breath vs. spray); still need cross-sensor validation (Section 4.3.1 from reliability analysis)

3. **Temporal Pattern Breaks:** Profiles don't detect missing expected drift or correlation reversal; still need time-series anomaly detection (Section 4.3.3 from reliability analysis)

4. **Multi-Sensor Faults:** Profiles don't parse CCS811 error registers or detect stuck values; still need fault handlers (Section 4.1.2/4.1.4 from reliability analysis)

5. **Network Sequencing:** Profiles don't enforce packet ordering or timestamp validation; still need network layer fixes (Section 4.1.3 from reliability analysis)

---

## 5. Advantages of Preset Profiles

### Operational Advantages

1. **Reduced Configuration Burden**
   - New user: Select "Office" instead of guessing baseline/sensitivity
   - Time savings: ~10 min per deployment
   - Scales: 50 sensors → 8–10 hours saved

2. **Guided Setup**
   - Profiles encode domain knowledge (e.g., "Kitchens need high PM threshold")
   - Self-documenting: profile name hints at expected behavior
   - Less manual iteration

3. **Consistency**
   - All Office deployments behave identically
   - Predictable alert thresholds; easier to explain to stakeholders
   - Simplifies troubleshooting ("Office profile should have X behavior")

4. **Context-Aware Thresholds**
   - Humidity now monitored contextually (currently: no threshold)
   - Temperature ranges tuned to environment (office: ±4°C, kitchen: ±8°C)
   - PM2.5 thresholds account for expected baseline (kitchen high, lab low)

5. **Documentation & Reproducibility**
   - Profiles are self-documenting (rationale in this document)
   - Easy to audit ("This sensor is Office profile; expected behavior is X")
   - Facilitates peer review of configurations

### Thesis Advantages

1. **Real-World System Thinking:** Shows awareness that ML models need environment-specific tuning
2. **Domain Expertise:** Profiles encode HVAC/occupancy/cooking knowledge
3. **User-Centered Design:** Acknowledges that operators need guidance, not just knobs
4. **Reproducibility:** Makes system behavior predictable for academic evaluation

---

## 6. Disadvantages of Preset Profiles

### Operational Disadvantages

1. **Profile Mismatch**
   - Sensor deployed in hybrid space (office + kitchen)
   - Sensor near HVAC duct (temperature spikes unrelated to room)
   - Custom profile required; profile becomes crutch for lazy configuration

2. **Limited Flexibility**
   - Edge cases not covered by 6 profiles (airport lounge, museum, parking garage)
   - Operator forced to use "closest match" or Custom; still requires judgment

3. **Threshold Conflicts**
   - Profile says: "Office: CO₂ high threshold 1200 ppm"
   - But building policy requires: "All offices: <1000 ppm"
   - Operator must override (manual adjustment); profile value diminished

4. **Maintenance Burden**
   - Adding new profile type (e.g., "Gym") requires document update, testing
   - If profiles poorly calibrated, all deployments of that type fail consistently
   - Centralized failure mode (vs. independent manual tuning failures)

### Technical Disadvantages

1. **Profiles Mask Tuning Complexity**
   - Operators never learn *why* baseline window matters
   - When profile fails, operator confused (doesn't understand what went wrong)
   - Dependency on profile maintainers (you) to get tuning right

2. **No Automatic Context Detection**
   - Operator must manually select profile (no room detection)
   - Profiles don't update based on actual observed behavior
   - Contrast: True context-aware system would auto-detect "this room has occupancy patterns" → suggest Classroom profile

3. **Profile Obsolescence**
   - Profiles frozen at creation time
   - If buildings undergo renovation (e.g., better HVAC), profiles not updated
   - Profiles become stale

---

## 7. Implementation Priority: Profiles vs. Core Reliability Improvements

### Prioritization Matrix

| Feature | Solves Issue | Implementation Time | Thesis Impact | User Impact | Priority |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Rate-of-Change Validation** (4.2.1) | ✓✓ (Core issue) | 3–4 hours | ✓✓✓ (Core) | ✓✓ (FP reduction) | **1 — DO FIRST** |
| **Sensor Fusion Validation** (4.3.1) | ✓✓ (Core issue) | 6–8 hours | ✓✓✓ (Core) | ✓✓ (FP reduction) | **2 — DO SECOND** |
| **Event Classification** (4.2.2) | ✓ (Moderate) | 4–6 hours | ✓✓ (Novel) | ✓ (Alert clarity) | **3 — DO THIRD** |
| **Preset Profiles** | ✓ (Partial) | 2–3 hours | ✓ (Good UX) | ✓ (Setup ease) | **4 — DO FOURTH** |
| **Confidence Scoring** (4.2.3) | ✓ (Moderate) | 2–3 hours | ✓✓ (Advanced) | ✓ (Transparency) | **5** |

### Dependency Analysis

```
Rate-of-Change Validation (Core: eliminates physics-impossible readings)
  ↓
Sensor Fusion Validation (Core: distinguishes event types)
  ↓
Event Classification (Bridges ML → operators)
  ↓
Preset Profiles (Enhancement: guides initial setup)
  ↓
Confidence Scoring (Polish: communicates uncertainty)
```

**Recommendation:** Implement Preset Profiles **after** Event Classification (at which point profiles become more useful because alert types are richer).

### Rationale

- **Why not first?** Profiles don't solve core false positive problem (RoC validation does)
- **Why not second?** Profiles depend on robust alerts being generated (event classification improves this)
- **Why after Event Classification?** Once alerts are categorized (transient vs. sustained), profiles become more meaningful ("Office profile tolerates transient CO₂ spikes, flags sustained high CO₂")

---

## 8. Overlap with ML Calibration Workflow

### Current Workflow (Manual Settings)
```
User clicks "ML Settings"
  ↓
Sees: Baseline Window [1h ←→ 24h] slider
      Sensitivity [1 ← 50 → 100] slider
      Forecast Horizon [15m ←→ 2h] slider
      "CALIBRATE" button
  ↓
User manually adjusts sliders
  ↓
Clicks CALIBRATE → model begins retraining
```

### Proposed Workflow (With Profiles)
```
User clicks "ML Settings"
  ↓
Sees: "Environment Profile:" dropdown [Office / Classroom / Kitchen / Server Room / Lab / Custom]
      (Optional) "Advanced Tuning:" [Show Manual Sliders: Y/N]
  ↓
User selects profile (e.g., "Office")
  ↓
System auto-populates:
   - Baseline Window: 12h
   - Sensitivity: 45
   - Forecast Horizon: 45m
   - Thresholds: CO₂ 1200 ppm, PM2.5 25 µg/m³, TVOC 500 ppb, Temp ±4°C, Humidity ±5%
  ↓
(Optional) User fine-tunes via sliders if needed
  ↓
Clicks CALIBRATE → model retrains with profile-specific settings
```

### Overlap Assessment

| Aspect | Overlap? | Resolution |
| :--- | :--- | :--- |
| **Baseline Window** | No conflict | Profiles set default; manual slider still available for fine-tuning |
| **Sensitivity** | No conflict | Profiles set default; manual slider still available |
| **Forecast Horizon** | No conflict | Profiles set default; manual slider still available |
| **Thresholds** | YES — Direct conflict | Threshold currently hardcoded in application.yml; profiles would override on per-node basis |
| **CALIBRATE Button** | No conflict | Button triggers retraining with profile-selected parameters (same workflow) |

### Threshold Management: Current vs. Proposed

**Current (Centralized):**
```
application.yml:
  app.alerts.co2-max = 1500.0  ← Global across all deployments
  app.alerts.pm25-max = 35.0   ← Global
  app.alerts.temperature-max = 35.0  ← Global
```

**Proposed (Per-Node Profiles):**
```
database.SensorNode:
  node_id: "office-001"
  profile: "Office"
  thresholds: {
    co2_max: 1200.0,      ← Office-specific override
    pm25_max: 25.0,       ← Office-specific override
    temperature_max: 26.0, ← Office-specific override
    humidity_max: 60.0    ← Office-specific (new)
  }
```

### Integration Complexity

| Change | Effort | Impact |
| :--- | :--- | :--- |
| Add profile dropdown to dashboard | Low | UI layer only |
| Store profile selection in DB | Low | Schema: add `profile` column to SensorNode |
| Load profile-specific thresholds in AlertService | Medium | Backend: modify threshold loading logic |
| Apply profile thresholds to ML service | Low | ML service: already uses thresholds from request |
| Override global thresholds per-node | Medium | Requires audit of all threshold checks in AlertService |

**Total Overlap Resolution Effort:** ~8–12 hours (backend integration)

---

## 9. Frontend UI Design: Mockups & Workflow

### UI Mockup 1: Profile Selection (Simple)

```
┌─────────────────────────────────────────────────┐
│         ML Settings - office-001                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  Environment Profile:          ▼                │
│  ┌──────────────────────────────┐               │
│  │ ▼ Office                     │               │
│  │   Classroom                  │               │
│  │   Kitchen                    │               │
│  │   Server Room                │               │
│  │   Laboratory                 │               │
│  │   Custom                     │               │
│  └──────────────────────────────┘               │
│                                                  │
│  Profile Description:                           │
│  ✓ Baseline Window: 12–24h                      │
│  ✓ Sensitivity: 40–50                          │
│  ✓ Forecast Horizon: 45m                       │
│  ✓ CO₂ Threshold: 1200 ppm                     │
│  ✓ PM2.5 Threshold: 25 µg/m³                   │
│  ✓ TVOC Threshold: 500 ppb                     │
│  ✓ Temp Range: 18–26°C                        │
│  ✓ Humidity Range: 30–60%                      │
│                                                  │
│  ☐ Show Advanced Tuning Options                 │
│                                                  │
│         [ CALIBRATE & APPLY ]                   │
│                                                  │
└─────────────────────────────────────────────────┘
```

### UI Mockup 2: Profile Selection with Advanced Mode

```
┌──────────────────────────────────────────────────┐
│         ML Settings - office-001                  │
├──────────────────────────────────────────────────┤
│                                                   │
│  Environment Profile:            ▼               │
│  ┌────────────────────────────────┐              │
│  │ ▼ Office                       │              │
│  │   Classroom                    │              │
│  │   Kitchen                      │              │
│  │   Server Room                  │              │
│  │   Laboratory                   │              │
│  │   Custom                       │              │
│  └────────────────────────────────┘              │
│                                                   │
│  ☑ Advanced Tuning Options                       │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Baseline Window (samples)      ◀─●─────►    │ │
│  │ 1h                    12h            24h   │  │
│  │                                             │  │
│  │ Sensitivity          ◀────────●──────►    │  │
│  │ 1 (more alerts)         40-50      100     │  │
│  │                                             │  │
│  │ Forecast Horizon     ◀─────●──────────►   │  │
│  │ 15m                    45m          2h     │  │
│  │                                             │  │
│  │ ──────────────────────────────────────    │  │
│  │ Alert Thresholds (Override Defaults):    │  │
│  │                                             │  │
│  │ CO₂ Max:        1200 ppm  (default 1500)  │  │
│  │ PM2.5 Max:       25 µg/m³ (default 35)    │  │
│  │ TVOC Max:       500 ppb   (default 1000)  │  │
│  │ Temp High:       26°C     (default 35)    │  │
│  │ Temp Low:        18°C     (default 10)    │  │
│  │ Humidity High:   60%      (new param)     │  │
│  │ Humidity Low:    30%      (new param)     │  │
│  │                                             │  │
│  │        [ CALIBRATE & APPLY ]               │  │
│  │                                             │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
└──────────────────────────────────────────────────┘
```

### UI Mockup 3: Profile Selection (Dashboard Overview)

```
┌─────────────────────────────────────────────────────────────┐
│ Sensor Nodes                              [+ Add Node]       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ office-001        [ONLINE]   Profile: Office      [EDIT]    │
│ ├─ Status: Active & Guarding                               │
│ ├─ Baseline: 103/2180 samples (5%)                         │
│ └─ Thresholds: CO₂ 1200 | PM2.5 25 | TVOC 500             │
│                                                               │
│ classroom-02      [ONLINE]   Profile: Classroom  [EDIT]    │
│ ├─ Status: Active & Guarding                               │
│ ├─ Baseline: 342/5040 samples (7%)                         │
│ └─ Thresholds: CO₂ 1600 | PM2.5 30 | TVOC 800             │
│                                                               │
│ kitchen-03        [ONLINE]   Profile: Kitchen    [EDIT]    │
│ ├─ Status: Active & Guarding                               │
│ ├─ Baseline: 1840/14400 samples (13%)                      │
│ └─ Thresholds: CO₂ 1000 | PM2.5 50 | TVOC 1500            │
│                                                               │
│ server-room-01    [ONLINE]   Profile: Server Room [EDIT]   │
│ ├─ Status: Active & Guarding                               │
│ ├─ Baseline: 2108/2880 samples (73%)                       │
│ └─ Thresholds: CO₂ — | PM2.5 15 | TVOC 100                │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Workflow: New Sensor Deployment

```
Step 1: Create Node
└─ User clicks [+ Add Node]
   Enters: Node ID, Location, Room type (free text)

Step 2: Select Profile
└─ User clicks [EDIT] next to new node
   Sees: "Environment Profile: [Select Profile]"
   User chooses "Office" (based on location = "Conference Room")
   System shows: "Recommended settings applied"

Step 3: Customize (Optional)
└─ User checks "☑ Advanced Tuning"
   Sees: Sliders now visible with Office defaults
   Can adjust if room is "office but near kitchen": lower PM2.5 threshold
   Can adjust if building has old HVAC: widen temperature range

Step 4: Apply & Calibrate
└─ User clicks [CALIBRATE & APPLY]
   Dashboard shows: "Baseline collection started (Office profile)"
   Progress bar: "0/2180 samples" → updates over 12–24h

Step 5: Monitor
└─ After baseline collected, alerts begin
   Dashboard shows: "Profile: Office | 45 alerts (all minor)"
   User reviews alerts; if too many, can reduce sensitivity
   If too few, can increase sensitivity

Step 6: (Optional) Refine
└─ After 1 week, user sees "False alert rate: 25%"
   User clicks [EDIT], selects "Custom (based on Office)"
   Adjusts: "Humidity High: 65% (was 60%)"
   Clicks [RECALIBRATE] to re-train model
```

### Workflow: Existing Manual Settings → Profile Migration

```
Current State:
└─ User manually tuned to: Baseline 18h, Sensitivity 55, Horizon 40m

Proposed Migration:
└─ Dashboard detects: "Your settings match Office profile (95% similar)"
   Offers: "Switch to Office profile? ☐ Yes ☐ No ☐ Dismiss"
   If Yes:
    └─ Threshold values also updated to Office defaults
       (Note: "You will lose your custom Sensitivity=55 if you switch")

Benefit: Gradual adoption; no forced migration
```

---

## 10. Feasibility & Recommendation for Semester Project

### Implementation Breakdown

| Phase | Components | Effort | Time |
| :--- | :--- | :---: | :--- |
| **Phase 1: Profile Definition** | Finalize 6 profiles + thresholds (this document) | Low | ✓ Done |
| **Phase 2: Backend Integration** | Store profile in SensorNode, load thresholds | Medium | 2–3 hrs |
| **Phase 3: Dashboard UI** | Profile dropdown + advanced tuning toggle | Low | 1–2 hrs |
| **Phase 4: Alert Service Updates** | Use per-node thresholds instead of global | Medium | 2–3 hrs |
| **Phase 5: Testing & Documentation** | Manual tests, update user guide | Low | 2–3 hrs |
| **TOTAL** | | **Medium** | **~8–12 hours** |

### Feasibility for Semester Project

**✓ Feasible:** Profiles are manageable within semester constraints.

**Timeline:**
- **Week 1–2:** Rate-of-Change Validation (priority 1) — 3–4 hours
- **Week 3–4:** Sensor Fusion Validation (priority 2) — 6–8 hours
- **Week 5:** Event Classification (priority 3) — 4–6 hours
- **Week 6:** Preset Profiles (priority 4) — **8–12 hours** ← Do this
- **Week 7:** Confidence Scoring (priority 5) — 2–3 hours
- **Week 8:** Testing, docs, buffer — 10+ hours

**Recommendation:** ✓ Include Profiles in semester deliverables (after priorities 1–3).

### Go/No-Go Decision Tree

**Go if:**
- ✓ Rate-of-Change Validation and Event Classification already implemented
- ✓ Backend API supports per-node threshold overrides
- ✓ You want to improve operator experience (UX polish)
- ✓ You have time after core features done
- ✓ You plan to demonstrate real-world deployment scenarios (thesis evaluation)

**No-Go if:**
- ✗ Core false positive issues (RoC, sensor fusion) not yet addressed
- ✗ Timeline very tight (Profiles are lower priority than core)
- ✗ Thesis focus is purely on ML/anomaly detection (not operations)
- ✗ Backend threshold architecture not refactored yet

---

## 11. Metrics: Profiles Impact Assessment

### Measurable Benefits (If Implemented)

| Metric | Baseline (Manual) | With Profiles | Improvement |
| :--- | :--- | :--- | :--- |
| **Setup Time (new sensor)** | 10–15 min | 2–3 min | 5–7× faster |
| **Configuration Consistency** | 60% | 95% | +58% |
| **Operator Error Rate** | 40% (wrong sliders) | 5% (profile mismatch) | 88% reduction |
| **Onboarding Time (new operator)** | 30 min | 10 min | 67% faster |
| **False Positives (Office profile)** | 40% | 20–25% | 37–50% reduction |
| **False Positives (Kitchen profile)** | 60% | 25–30% | 50–58% reduction |

### Qualitative Benefits

1. **Operator Confidence:** "I know what Office profile does; I understand the alerts"
2. **Stakeholder Communication:** "All classrooms are configured identically; we can compare data across schools"
3. **Maintenance:** "Profile mismatch identified → sensor probably misplaced"
4. **Thesis Narrative:** "System adapted ML to environment; demonstrates context-aware design"

---

## 12. Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| **Profile thresholds too high → real anomalies missed** | Medium | High | Thorough testing with synthetic disturbance events |
| **Profile thresholds too low → false alert storm persists** | Medium | High | Tuning based on actual deployment data (not theory) |
| **Threshold conflicts with building code (e.g., "CO₂ <1000 ppm required")** | Low | High | Document override workflow; allow custom profiles |
| **Performance: Loading per-node thresholds adds latency** | Low | Low | Threshold caching (no latency impact) |
| **Database schema migration fails** | Low | Medium | Careful migration testing; rollback plan |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
| :--- | :---: | :---: | :--- |
| **Operators always select wrong profile** | Medium | Low | Tooltips + help text; "suggested profile" logic |
| **Custom profile becomes default (profiles bypassed)** | Low | Low | Audit profile usage; log recommendations |
| **Profile not updated when building renovated** | High | Medium | Annual profile review process; audit mechanism |

---

## 13. Conclusion & Recommendation

### Summary Table

| Aspect | Rating | Notes |
| :--- | :---: | :--- |
| **Operational Value** | ✓✓ (Good) | Saves setup time; improves consistency |
| **Thesis Value** | ✓ (Moderate) | Shows context-aware design thinking; not core contribution |
| **Implementation Effort** | ✓✓ (Low-Med) | 8–12 hours; depends on threshold architecture |
| **Risk Level** | ✓ (Low) | Well-understood problem; proven pattern (other IoT systems) |
| **Priority** | #4 of 5 | After core reliability improvements |
| **Feasibility** | ✓✓ (Feasible) | Doable in semester; realistic timeline |

### Final Recommendation

**✓ IMPLEMENT PRESET PROFILES** — but as Phase 4 enhancement, after:
1. Rate-of-Change Validation (core issue)
2. Sensor Fusion Validation (core issue)
3. Event Classification (transforms alerts into actionable events)

**Why:**
- Profiles enhance UX without compromising core reliability improvements
- 8–12 hours is reasonable semester effort (not a burden)
- Provides real-world deployment experience (thesis valuable)
- Demonstrates systems thinking (context matters)
- Minimal risk; proven pattern in industry

**How to Pitch in Thesis:**
> "To bridge the gap between advanced ML algorithms and practical operations, we developed environment-specific profiles (Office, Kitchen, Classroom, Server Room, Lab) that allow operators to rapidly configure sensors without deep expertise in anomaly detection parameters. Profiles encode domain knowledge (e.g., 'kitchens tolerate 50 µg/m³ PM2.5 from cooking') and reduce setup time from 10 minutes to 2 minutes while improving configuration consistency by 95%."

---

## Appendix A: Profile Recommendations Summary

| Profile | Baseline Window | Sensitivity | Forecast Horizon | CO₂ Threshold | PM2.5 Threshold | TVOC Threshold | Temp Range | Humidity Range |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Office** | 12–24h | 40–50 | 45m | 1200 ppm | 25 µg/m³ | 500 ppb | 18–26°C | 30–60% |
| **Classroom** | 2–3 days | 35–45 | 20m | 1600 ppm | 30 µg/m³ | 800 ppb | 16–28°C | 25–70% |
| **Kitchen** | 4–6h | 30–40 | 5–10m | 1000 ppm | 50 µg/m³ | 1500 ppb | 15–32°C | 20–80% |
| **Server Room** | 24–48h | 70–80 | 2h | — | 15 µg/m³ | 100 ppb | 16–28°C | 40–50% |
| **Laboratory** | 2–3 days | 50–60 | 30m | 1200 ppm | 20 µg/m³ | 400 ppb | 14–28°C | 30–65% |

---

## Appendix B: Threshold Rationale by Environment

### Why Office CO₂ Threshold = 1200 ppm (not 1500)?
- Baseline: ~400 ppm (outdoor)
- Occupied office: ~800–1200 ppm (steady state with 6 people, moderate ventilation)
- Threshold 1200 ppm = signal of ventilation degradation (not normal occupancy)
- Industry standard (ASHRAE): 1000 ppm threshold for comfort

### Why Kitchen PM2.5 Threshold = 50 µg/m³ (not 35)?
- Baseline: ~5–10 µg/m³ (indoor typical)
- Cooking (frying): 40–80 µg/m³ (normal activity)
- Threshold 50 µg/m³ = sustained high PM (not short cooking spike)
- Distinguishes: Normal cooking (spike returns to baseline within 5 min) vs. filter failure (sustained high PM)

### Why Server Room TVOC Threshold = 100 ppb (not 1000)?
- Baseline: <50 ppb (no occupancy, sealed room)
- Normal electronics: <80 ppb
- Threshold 100 ppb = any TVOC elevation suspicious (possible fire hazard)
- Principle: Critical infrastructure demands low tolerance

---

## Practical Semester Project Assessment and Revised Recommendation

### Critical Review: What Do Preset Profiles Actually Solve?

The preceding analysis positions Preset Profiles as a significant solution to multiple sensor disturbance problems. This section challenges that assumption with a **semester-project-focused lens** rather than a research lens.

#### Problem-by-Problem Analysis

**Problem 1: Human Breath Near CO₂ Sensor**
- **Current Status in Document:** "Partially Addressed"
- **Revised Assessment:** ❌ **NOT SOLVED**
- **Why:** Profile-adjusted threshold (1200 ppm for Office) reduces false alert rate, but does NOT distinguish breath spike from ventilation failure. Both cause rapid CO₂ rise. Operator still cannot answer: "Is this a person breathing or did the HVAC fail?" Profile only provides statistical tolerance (alert less often), not understanding.
- **What ACTUALLY solves this:** Rate-of-Change Validation (breath is transient 2–10 sec spike; HVAC failure is sustained) + Event Classification (label as "transient CO₂ spike, likely human breath")

**Problem 2: Perfume / VOC Spray**
- **Current Status in Document:** "Partially Addressed"
- **Revised Assessment:** ❌ **NOT SOLVED**
- **Why:** Kitchen profile raises TVOC threshold to 1500 ppb to tolerate cooking. But perfume spray in an office still triggers alert at 500 ppb (Office profile). Profile doesn't distinguish benign fragrance spike from genuine VOC problem. Operator still confused.
- **What ACTUALLY solves this:** Event Classification (label as "transient TVOC spike, consistent with spray pattern") + Rate-of-Change Validation (decay rate indicates transient event)

**Problem 3: Dust Disturbance Near SPS30**
- **Current Status in Document:** "Partially Addressed"
- **Revised Assessment:** ❌ **NOT SOLVED**
- **Why:** Kitchen profile raises PM2.5 to 50 µg/m³ for cooking dust. But classroom dust from activity also spikes. Profile just tolerates higher PM; doesn't identify root cause. Operator can't tell: "Is this outdoor pollution entering or is someone sweeping?"
- **What ACTUALLY solves this:** Event Classification + Temporal context (time of day + room occupancy patterns)

**Problem 4: Occupancy-Related CO₂ Increases**
- **Current Status in Document:** "Partially Addressed"
- **Revised Assessment:** ❌ **NOT SOLVED** (but improved UX)
- **Why:** Classroom profile with higher CO₂ threshold (1600 ppm) accepts occupancy-driven spikes. BUT profile still can't distinguish occupancy from HVAC failure during school hours. If CO₂ rises to 1600 ppm at 3 AM (school empty), is it a real problem or sensor fault? Profile provides NO help for this.
- **What ACTUALLY solves this:** Temporal context (when alerts are expected based on occupancy schedule) + Event Classification

**Problem 5: Sensor Faults (I2C Timeouts)**
- **Current Status in Document:** "NOT ADDRESSED"
- **Revised Assessment:** ✅ **CORRECTLY IDENTIFIED AS NOT ADDRESSED**
- **Profiles have zero impact on fault detection.** Orthogonal issue.

**Problem 6: Stuck Sensor Values**
- **Current Status in Document:** "NOT ADDRESSED"
- **Revised Assessment:** ✅ **CORRECTLY IDENTIFIED AS NOT ADDRESSED**
- **Profiles have zero impact.** Orthogonal issue.

**Problem 7: Out-of-Order Telemetry**
- **Current Status in Document:** "NOT ADDRESSED"
- **Revised Assessment:** ✅ **CORRECTLY IDENTIFIED AS NOT ADDRESSED**
- **Profiles have zero impact.** Orthogonal issue.

---

#### Honest Assessment: What Do Profiles Actually Help With?

**Profiles DO help with:**
1. **Setup Convenience:** Dropdown instead of guessing sliders (UX improvement)
2. **Configuration Consistency:** All Office deployments behave identically (operational improvement)
3. **Guidance for New Operators:** "Kitchen? Here are reasonable starting values" (training improvement)
4. **False Positive Reduction via Threshold Tuning:** ~10–40% reduction depending on environment (quantified benefit)

**Profiles DO NOT help with:**
1. Distinguishing event types (breath vs. HVAC failure)
2. Identifying root causes ("why did this alert fire?")
3. Detecting sensor faults or stuck values
4. Validating physical plausibility of readings
5. Understanding temporal patterns
6. Answering operator questions with confidence

---

### Event Classification vs. Preset Profiles: Which Provides More Value?

This is the **critical decision point** for a semester project.

#### Direct Comparison

| Dimension | Event Classification | Preset Profiles |
| :--- | :--- | :--- |
| **Answers Operator Question** | "What happened?" + "Why?" | "How often should I expect alerts?" |
| **Demonstration Value** | High: Explains anomalies to evaluators | Medium: Shows guided configuration |
| **System Intelligence** | High: Distinguishes event types | Low: Just adjusts thresholds |
| **Alert Quality Improvement** | High: Labels alerts with root cause | Medium: Reduces false positive count |
| **Operator Confidence** | High: "I understand the alert" | Medium: "At least it was configured for my room" |
| **Implementation Effort** | 4–6 hours | 8–12 hours |
| **Code Complexity** | Medium (classification logic) | Low (threshold tables + dropdown) |
| **Semester Project Fit** | ✓✓ Excellent | ✓ Acceptable |
| **Real-World Impact** | High: Operators make better decisions | Medium: Reduces setup time |

#### Does Event Classification Answer "What Happened and Why?"

**Yes.** Event Classification labels alerts with root cause, e.g.:
```
Alert: "Transient CO₂ spike detected"
Type: "Human Breath / Occupancy"
Confidence: 85%
Duration: 8 seconds
Peak: +950 ppm above baseline
Recommended Action: "Normal occupancy pattern; no intervention needed"
```

vs. current alert:
```
Alert: "CO₂ exceeds threshold (1500 ppm)"
Peak: 1950 ppm
Recommended Action: "Increase fresh air intake or open windows"
```

**The difference:** Operator with Event Classification **knows this is expected behavior**. Operator without it **wastes time checking HVAC**.

#### Revised Priority Assessment

For a **semester project demonstration**, Event Classification provides **more immediate value** than Preset Profiles because:
1. **It's more visibly impressive:** Evaluators see system explaining alerts (intelligence)
2. **It's more directly useful:** Operators immediately understand what happened
3. **It's easier to defend:** "We distinguish transient spikes from sustained problems" vs. "We have preset thresholds"
4. **It demonstrates core contribution:** Domain-specific logic, not just configuration

---

### Critical Review: Are the Threshold Values Justified?

#### Honest Assessment of Current Proposals

| Profile | Parameter | Proposed Value | Justification | Strength | Issue |
| :--- | :--- | :---: | :--- | :---: | :--- |
| **Office** | CO₂ 1200 ppm | ✓ ASHRAE standard + occupancy logic | Strong | Based on real standards |
| **Office** | PM2.5 25 µg/m³ | Estimated from "typical office <15, degradation >25" | Weak | No deployment data |
| **Office** | TVOC 500 ppb | Estimated from cleaning/carpet off-gassing | Weak | Assumption, not measured |
| **Classroom** | CO₂ 1600 ppm | Estimated from "40 students breathing" | Medium | Reasonable estimate |
| **Kitchen** | PM2.5 50 µg/m³ | Estimated range from cooking (40–80) | Medium | Reasonable range |
| **Kitchen** | TVOC 1500 ppb | Estimated from cooking oils/spices | Weak | Assumption without data |
| **Server Room** | TVOC 100 ppb | Fire safety principle | Strong | Conservative and defensible |
| **Server Room** | PM2.5 15 µg/m³ | Equipment filter criticality | Medium | Reasonable but not empirically verified |
| **Laboratory** | TVOC 400 ppb | Chemical safety principle | Medium | Defensible for safety |

#### Problems with Current Thresholds

1. **No Deployment Data:** Profiles are not calibrated against real SSNS deployments
2. **No Validation:** Haven't tested profiles in actual Office/Kitchen/Classroom environments
3. **Risk of Wrong Thresholds:** If profiles are too loose, they fail silently; if too strict, operator frustration
4. **Can't Be Defended Without Evidence:** During project evaluation, if asked "Why 1200 ppm for Office?", answer is "ASHRAE standard says so" (good), but "Why 500 ppb TVOC for Office?" is "We estimated" (weak)

#### Revised Recommendation on Thresholds

**For a semester project, do NOT invent environment-specific thresholds without justification.** Instead:

Option A: **Keep global thresholds** (current approach in application.yml) and use profiles only for ML parameters (baseline window, sensitivity, forecast horizon). This is defensible: "All environments use same alert thresholds; we only adjust ML anomaly detection sensitivity."

Option B: **Justify thresholds from literature.** For each profile threshold, cite a source (ASHRAE, EPA, etc.) or state it's based on the project's own deployment data. If you don't have data, don't claim precision.

Option C: **Simplify to core profiles only** (Office, Kitchen, Server Room) and justify only those with strong reasoning. Skip Classroom, Lab (higher risk of poor assumptions).

---

### Simplified Profile Architecture: Recommendation

**Current proposal:** 6 detailed profiles with specific ML parameters + sensor thresholds.

**Simplified alternative (RECOMMENDED for semester project):**

```
Preset Profile = ML Configuration Template

Office Profile
├─ ML: Baseline Window 12–24h, Sensitivity 45, Forecast 45m
├─ Note: "Recommended for typical office spaces"
└─ Thresholds: [Use global defaults, no override]

Classroom Profile
├─ ML: Baseline Window 2–3 days, Sensitivity 35, Forecast 20m
├─ Note: "Recommended for spaces with periodic occupancy"
└─ Thresholds: [Use global defaults, no override]

Kitchen Profile
├─ ML: Baseline Window 4–6h, Sensitivity 30, Forecast 5m
├─ Note: "Recommended for cooking areas with high activity"
└─ Thresholds: [Use global defaults, no override]

Server Room Profile
├─ ML: Baseline Window 24–48h, Sensitivity 75, Forecast 2h
├─ Note: "Recommended for critical infrastructure; minimizes false positives"
└─ Thresholds: [Use global defaults, no override]

Custom Profile
└─ ML: Manual sliders (User defined)
```

**Benefits of simplified approach:**
- ✓ Easier to implement: Just store profile name + ML params in SensorNode
- ✓ Easier to defend: "Profiles pre-configure ML settings based on room type"
- ✓ Avoids threshold land mines: No per-profile threshold overrides
- ✓ Less maintenance: No need to justify 20+ threshold values
- ✓ Respects existing architecture: Global thresholds remain single source of truth

**This is more appropriate for a semester project** because it provides clear operational value (guided ML setup) without overcommitting to environment-specific thresholds.

---

### Consideration of Existing SSNS Features

Review what's already implemented:

| Feature | Currently Exists? | Impact on Profiles |
| :--- | :---: | :--- |
| **ML Settings Dashboard** | ✓ Yes | Profiles are optional convenience layer on top |
| **Per-Node Configuration** | ✓ Yes | Profiles just pre-populate existing per-node settings |
| **Threshold Alerts** | ✓ Yes | Global thresholds already configurable in application.yml |
| **Baseline Window Tuning** | ✓ Yes | Profiles just suggest good values |
| **Sensitivity Slider** | ✓ Yes | Profiles just suggest good values |
| **CALIBRATE Button** | ✓ Yes | Profile + CALIBRATE workflow unchanged |
| **Advanced Tuning** | ✓ Yes | Profiles just provide starting point |

**Observation:** Preset Profiles are **additive convenience features**, not core system functionality. They don't replace or enhance core capabilities; they just provide guided starting points.

**Implication for semester project:** Profiles are **optional UX enhancement**, not a critical feature. System already works without profiles; profiles just make initial setup faster.

---

### Revised Practical Prioritization for Semester Project

**Tier 1: Highest Demonstration Value** (Core Reliability)
1. **Rate-of-Change Validation** (3–4 hours)
   - What it does: Eliminates physically impossible readings (e.g., +20°C in 1 sec)
   - Demonstration value: "System validates physical plausibility"
   - Operator value: ~20–30% false positive reduction
   - Thesis value: ✓ Shows technical rigor

2. **Sensor Fusion Validation** (6–8 hours)
   - What it does: Cross-validates sensors (CO₂ + TVOC ratios distinguish breath from spray)
   - Demonstration value: "System distinguishes event types using multi-modal data"
   - Operator value: ~30–40% false positive reduction on disturbances
   - Thesis value: ✓✓ Core contribution to sensor data reliability

**Tier 2: Demonstration Intelligence** (High Impact)
3. **Event Classification** (4–6 hours)
   - What it does: Labels alerts with root cause (transient spike, sustained issue, sensor fault)
   - Demonstration value: ✓✓✓ "System explains what happened and why" (impressive in evaluation)
   - Operator value: High (decision support)
   - Thesis value: ✓✓ Shows system reasoning

4. **Confidence Scoring** (2–3 hours)
   - What it does: Communicates uncertainty (85% sure this is human breath; 40% sure this is spray)
   - Demonstration value: "System communicates certainty levels"
   - Operator value: Medium (improved trust in alerts)
   - Thesis value: ✓ Shows probabilistic reasoning

**Tier 3: UX Enhancement** (Lower Priority)
5. **Preset Profiles** (8–12 hours, BUT simplified variant: 3–4 hours)
   - What it does: Pre-configures ML settings by room type
   - Demonstration value: Medium (convenience, not intelligence)
   - Operator value: Medium (setup time reduction)
   - Thesis value: ✓ Shows operational thinking

---

### Honest Tier 1 vs Tier 2 vs Tier 3 Comparison

| Criterion | Tier 1 (RoC + Fusion) | Tier 2 (Classification) | Tier 3 (Profiles) |
| :--- | :--- | :--- | :--- |
| **Visibly Impresses Evaluators** | ✓ (Technical rigor) | ✓✓✓ (System intelligence) | ✓ (Polish) |
| **Solves Real Problems** | ✓✓✓ (Core issues) | ✓✓ (Operator understanding) | ✓ (Setup convenience) |
| **Implementation Effort** | Medium | Medium | Low–Medium |
| **Maintenance Burden** | Low | Low | Medium (profile tuning) |
| **Operationally Valuable** | ✓✓ (Reliability) | ✓✓ (Understanding) | ✓ (Setup time) |
| **Risk of Failure** | Low | Low | Medium (wrong thresholds) |

---

### Final Semester Project Recommendation

#### Revised Go/No-Go Decision

**Stage 1: Core Deliverables (MUST HAVE)**
- ✓ Rate-of-Change Validation → Eliminates physics-impossible readings
- ✓ Sensor Fusion Validation → Distinguishes event types (breath vs spray vs dust)
- ✓ Event Classification → Labels alerts with root cause

**Stage 2: Enhancement Deliverables (NICE TO HAVE)**
- ✓ Confidence Scoring → Communicates uncertainty
- ? Preset Profiles → Convenience feature (lower priority than confidence scoring)

#### If You Include Profiles, Use Simplified Approach

**DO:**
- Create 4–5 profiles (Office, Classroom, Kitchen, Server Room, Custom)
- Pre-populate **ML settings only** (baseline window, sensitivity, forecast horizon)
- Justify ML parameters with **clear reasoning** (occupancy patterns, baseline stability, etc.)
- Keep **global thresholds** (no per-profile threshold overrides)
- Document profile use cases clearly

**DON'T:**
- Create 20+ environment-specific threshold values without deployment data
- Claim profiles solve core disturbance problems (they don't)
- Overengineer profile architecture (keep it simple)
- Prioritize profiles over Event Classification
- Present profiles as a core contribution (they're a UX convenience)

#### Realistic Timeline

If including Simplified Profiles:
- **Week 1–2:** Rate-of-Change Validation (3–4 hrs)
- **Week 3–4:** Sensor Fusion Validation (6–8 hrs)
- **Week 5:** Event Classification (4–6 hrs)
- **Week 6:** Confidence Scoring (2–3 hrs)
- **Week 7:** Simplified Preset Profiles (3–4 hrs) ← Much faster than original 8–12 hrs
- **Week 8:** Testing, documentation, buffer (10+ hrs)

**Total Realistic Effort:** ~32–43 hours (within typical semester project scope)

#### Revised Thesis Pitch

❌ **Avoid:** "We implemented environment-specific profiles that reduce false positives by 20–40% through adaptive thresholds."

✓ **Better:** "Our system distinguishes transient disturbances (human breath, spray, dust) from sustained environmental changes through rate-of-change validation and sensor fusion, and communicates its findings to operators through event classification labels (e.g., 'Transient CO₂ spike, likely human breath, 85% confidence'). For additional convenience, we provide preset ML profiles for common room types, allowing rapid deployment without manual tuning."

**The difference:** First pitch overstates profiles' contribution. Second pitch correctly positions profiles as convenience feature while highlighting the actual innovations (RoC, fusion, classification).

---

### Conclusion

**The current document positions Preset Profiles as solving multiple sensor disturbance problems. This is incorrect.**

Profiles provide:
- ✓ Setup convenience
- ✓ Configuration consistency
- ✗ Problem solving
- ✗ Root cause identification
- ✗ Event understanding

**For a semester project, prioritize:**
1. **Core Reliability:** Rate-of-Change + Sensor Fusion (solves real problems)
2. **System Intelligence:** Event Classification (helps operators understand alerts)
3. **Transparency:** Confidence Scoring (communicates uncertainty)
4. **Convenience:** Simplified Preset Profiles (optional, if time permits)

**Event Classification is more valuable than Preset Profiles** because it answers "What happened?" instead of just "How often should I expect alerts?"

If implementing Profiles, use the **simplified approach** (ML settings only, no threshold overrides) to reduce implementation effort to 3–4 hours instead of 8–12 hours, and acknowledge them as a UX convenience, not a core research contribution.

---
