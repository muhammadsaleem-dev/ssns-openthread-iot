# Environmental Events & Heuristics

> 🎙️ **Presenting or Defending this Module?** See the full [7-Minute Technical Presentation & Q&A Defense Guide](ENVIRONMENTAL_EVENTS_PRESENTATION_GUIDE.md) for word-for-word talking points, timing allocations, and expert answers to tough examiner questions.

The SSNS Java Backend (`AlertService.java`) intelligently detects a variety of environmental events by applying statistical heuristics (like rolling means and standard deviations) to incoming sensor telemetry. This allows the system to differentiate between short-lived anomalies, sudden atmospheric shifts, and sustained conditions.

### Hardware Sensor Suite
- **SCD41** — Detects $\text{CO}_2$, Temperature, and Relative Humidity.
- **CCS811** — Detects Total Volatile Organic Compounds ($\text{TVOC}$).
- **SPS30** — Detects Optical Particulate Matter ($\text{PM}_{1.0}$, $\text{PM}_{2.5}$, $\text{PM}_{4.0}$, $\text{PM}_{10}$).

Below is the list of the **7 distinct environmental events** currently detected by the backend (`AlertService.java:75-185`), categorized by their behavioral patterns, including their logic and how to physically trigger them for testing.

---

## 🔍 Live Deployment Verification Matrix (`node-e9b1` Saleem's Room vs. `node-0587` Lecture Hall)

To maintain absolute scientific and engineering transparency, our team categorizes verification across our **dual-node real-world deployment zones**: our residential bedroom environment (`node-e9b1` Saleem's Room) and our public academic classroom environment (`node-0587` Lecture Hall Node). Because residential bedrooms and a lecture hall packed with ~40 students experience fundamentally different physical disturbances, the two nodes naturally verified 5 out of 7 heuristic events across live production telemetry:

| Heuristic Event | Alert Type (`AlertService.java`) | Verified Deployment Node & Exact Timestamp | Live Real-World Physics & Verification Context |
| :--- | :--- | :--- | :--- |
| **Sustained Occupancy** | `OCCUPANCY_EVENT` | ✅ **Lecture Hall (`node-0587`) & Saleem's Room** | Fired on **Jul 2 at 01:35 PM** as ~40 students sitting in the closed lecture hall caused $\text{CO}_2$ to climb cleanly above threshold and reach a stable metabolic equilibrium (`StdDev < 50`). |
| **Transient Breath** | `TRANSIENT_CO2_EVENT` | ✅ **Lecture Hall (`node-0587`) & Saleem's Room** | Fired on **Jul 2 at 12:51 PM, 01:32 PM, and 01:39 PM** when direct exhalation tests (`CO2Max > Mean + 2*Std`) were performed over the desk sensor node (`node-0587`) before quickly settling back to baseline (`Recovered`). |
| **Transient Aerosol/VOC** | `TRANSIENT_VOC_EVENT` | ✅ **Lecture Hall (`node-0587`)** | Fired on **Jul 2 at 12:46 PM** (`Chemical Odors, Cooking or Aerosols Detected`). Triggered naturally without manual testing as ~40 students entered the hall wearing perfumes/body sprays and applying hand sanitizer (`TvocMax > Mean + 1.5*Std`). |
| **Ventilation Draft** | `VENTILATION_EVENT` | ✅ **Saleem's Room (`node-e9b1`)** | Fired reliably in residential telemetry whenever the bedroom window or door was opened (`simultaneous dual-drop in Temp & CO2 below rolling means`). |
| **Localized Moisture** | `MOISTURE_EVENT` | ✅ **Saleem's Room (`node-e9b1`)** | Triggered during hot tea/coffee consumption near the bedroom desk sensor array (`Co2Std < 10`). |
| **Particulate Disturbance**| `PARTICULATE_EVENT` | ⚙️ **Logic Implemented (Test Pending)** | *Logic implemented in `AlertService.java:102` (`PM2.5 > Mean + 3*Std`).* Physical smoke/dust testing has not been performed yet to avoid disturbing indoor air quality during long-term logging. |
| **Active Janitorial Cleaning**| `CLEANING_EVENT` | ⚙️ **Logic Implemented (Test Pending)** | *Logic implemented in `AlertService.java:162` (`TVOC + PM2.5 simultaneous spike`).* Physical chemical spray + dusting test has not been performed yet, designating this as a compiled algorithmic capability awaiting validation. |

---

## 1. Purely Transient (Quick Spike & Recovery)
These events strictly require the sensor value to shoot up and then rapidly crash back down to the baseline to be classified.

### Transient CO2 Event (Direct Breath)
- **Alert Type:** `TRANSIENT_CO2_EVENT`
- **Logic:** Detects a sudden CO2 spike that rapidly recovers back below the statistical mean.
- **How to Test:** Breathe directly onto the <span style="color:#007BFF">**SCD41**</span> sensor for a few seconds, then step back and let the air clear.

### Transient VOC Event (Perfume / Spray)
- **Alert Type:** `TRANSIENT_VOC_EVENT`
- **Logic:** Detects a sudden TVOC spike that rapidly recovers back to the mean.
- **How to Test:** Bring an open whiteboard marker, hand sanitizer, or a quick spray of perfume near the <span style="color:#28A745">**CCS811**</span> sensor.

### Particulate Event (Dust / Smoke)
- **Alert Type:** `PARTICULATE_EVENT`
- **Logic:** Detects a sudden PM2.5 spike that rapidly recovers.
- **How to Test:** Light a match/candle, or aggressively shake a dusty cloth right next to the <span style="color:#FF8C00">**SPS30**</span> sensor.

---

## 2. State Shifts / Deltas (Sudden Changes)
These events detect a sudden, massive shift to a new atmospheric state. They do not require the value to recover in order to trigger.

### Ventilation Event (Window Draft)
- **Alert Type:** `VENTILATION_EVENT`
- **Logic:** Both Temperature and CO2 drop simultaneously below their respective mathematical means (Temp drops by > 0.2°C and CO2 drops by > 30ppm below the mean).
- **How to Test:** Open a cold window next to the <span style="color:#007BFF">**SCD41**</span> sensor or blow a fan/AC draft across it in a stuffy room.

### Active Cleaning Event
- **Alert Type:** `CLEANING_EVENT`
- **Logic:** A complex multi-sensor correlation where both TVOC and PM2.5 spike massively at the exact same time.
- **How to Test:** Spray a chemical cleaner and wipe down a dusty surface simultaneously near the <span style="color:#28A745">**CCS811**</span> and <span style="color:#FF8C00">**SPS30**</span> sensors.

### Moisture Event (Humidifier / Hot Drink)
- **Alert Type:** `MOISTURE_EVENT`
- **Logic:** Detects a localized humidity spike while CO2 remains completely stable. This differentiates it from human breath (which releases both moisture and CO2).
- **How to Test:** Hold a steaming hot cup of tea or a humidifier near the <span style="color:#007BFF">**SCD41**</span> sensor without breathing on it.

---

## 3. Sustained / Stable (The Opposite of Transient)
These events require a condition to be completely stable and sustained over a long period of time to trigger.

### Sustained Occupancy (Presence Detection)
- **Alert Type:** `OCCUPANCY_EVENT`
- **Logic:** CO2 climbs above 800ppm but has a very low standard deviation (< 50), meaning the air is stably polluted. The system uses passive CO2 emissions as a human presence sensor.
- **How to Test:** Sit in a small, closed room with the <span style="color:#007BFF">**SCD41**</span> sensor for 20-30 minutes until the CO2 naturally rises and plateaus.

---
*Note: Any sustained values that climb beyond the absolute maximum thresholds (e.g., CO2 > 1500ppm, Temp > 35°C) while maintaining a low standard deviation will bypass these informational events and trigger `CRITICAL` or `WARNING` alarms.*
