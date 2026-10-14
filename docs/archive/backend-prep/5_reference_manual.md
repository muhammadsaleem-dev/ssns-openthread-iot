# Dual-Engine Alerting System (Concise Viva & Presentation Guide)

## 🎯 Master Presentation Strategy (`How to Present Without Memorizing!`)

When you stand up to present or defend this project, remember: **You do NOT need to memorize this entire document word-for-word!** You are not a salesperson pitching a product—you are the lead engineer explaining a system you built from the ground up. Here are the three professional secrets to delivering a top-tier presentation with complete confidence:

### 1. The "Rule of 3" Storytelling Framework (`Your Mental Roadmap`)
Instead of trying to memorize 8 rules and 5 examples, just hold **this one simple 3-part story** in your mind:
* **Chapter 1 — The Problem:** *"If we only use simple thresholds (`like a basic building thermostat`), we get constant false alarms every time someone breathes near the sensor, sets down a hot cup of tea, or sweeps dust."*
* **Chapter 2 — Your Solution (`The Dual Engine`):** *"So I built two complementary engines. **Engine 1** handles immediate life safety (`checking ASHRAE & WHO health limits`). **Engine 2** checks 3-minute rolling averages and multi-sensor correlation (`checking how sensors move together`) to understand WHY the change happened."*
* **Chapter 3 — The Proof (`Two Killer Real-World Examples`):**
  * **Proof 1 (`Multi-Sensor Correlation & Life Safety - Example 2B`):** *"For instance, if an exterior window opens during freezing sub-zero weather and the room hits 7°C, Engine 1 immediately triggers a critical low-temperature alarm to prevent hypothermia and freezing pipes. At the exact same time, Engine 2 correlates the thermal drop with simultaneous CO₂ dilution (`VENTILATION_EVENT`) to tell building managers the root cause: 'Someone left the window wide open!'"*
  * **Proof 2 (`Thermodynamic Gas Cross-Check - Example 3`):** *"Our second proof is separating hot tea from human breath. Both actions cause a sudden relative humidity jump near the sensor (`RH > 60%`). To avoid confusing them, Engine 2 cross-checks Carbon Dioxide variance (`Standard Deviation`). Because steam from tea is pure water vapor (`CO₂ variation < 10 ppm`), it correctly classifies it as a `MOISTURE_EVENT`. If CO₂ variation were jumping wildly (`> 30 ppm`), it would know a person was exhaling!"*

### 2. Let Your Slides Do the Heavy Lifting (`Visual Anchors`)
Remember that every example below has an ultra-clean **`🖥️ What to present on your slide`** section (`3 punchy bullet points`). **Those 3 bullet points on the screen are for YOU as much as the audience!** When you click to a slide, don't try to recite from memory. Look at the 3 bullet points on screen—they will instantly act as visual triggers for your brain, allowing you to explain the scenario naturally!

### 3. The Engineer Q&A Power Move (`Show the Live Code`)
If a professor asks a tough technical question during Q&A (`e.g., "Why did you choose 100 ppm as the noise floor?"` or `"Where are the debounce timers checked?"`), you don't have to recite exact lines of code from memory! Use this **Engineer Power Move**:
> *"Professor, that threshold comes directly from the Sensirion hardware accuracy datasheet (`plus or minus 40 ppm plus 5%`) to prevent false alarms from natural sensor drift. In fact, if we open **`AlertService.java`** right here on my screen around line 115, you can see how we coded `Math.max(2.0 * data.getCo2Std(), 100.0)` to enforce that exact hardware floor."*
*(Professors love when a student opens up the actual IDE during Q&A to show real, live code. It proves 100% authenticity and mastery!)*

---

## Why do we need two engines?

Our system uses two complementary alert engines because one engine alone cannot provide both life safety and intelligent activity recognition.

* Engine 1 answers: “Is this dangerous?”
* Engine 2 answers: “What is happening and why?”

---

## Engine 1 – Threshold-Based Alerts

### Purpose

Provides immediate life-safety protection by comparing sensor readings against predefined health limits.

### How it works

Every sensor packet arriving from the OpenThread network is checked against configurable thresholds stored in `application.yml`.

If the conditions are satisfied, the backend immediately creates a `WARNING` or `CRITICAL` alert.

### Threshold Summary

| Sensor | Threshold | Standard | Alert |
| :--- | :--- | :--- | :--- |
| **CO₂ (SCD41)** | **>1500 ppm** | ASHRAE 62.1 | HIGH_CO2 (WARNING) |
| **Temperature (MCP9808)** | **>35°C** | ASHRAE 55 | TEMPERATURE_HIGH |
| | **<10°C** | ASHRAE 55 | TEMPERATURE_LOW |
| **PM2.5 (SPS30)** | **>35 μg/m³** | WHO / EPA | COMBUSTION_WARNING (CRITICAL) |
| **TVOC (CCS811)** | **>1000 ppb** | WELL v2 | SUSTAINED_ENVIRONMENTAL_CHANGE (WARNING) |

---

### Why these values?

They come from internationally recognized standards, not arbitrary numbers.

* ASHRAE 62.1 -> Indoor air quality
* ASHRAE 55 -> Thermal comfort
* WHO / EPA -> Particulate matter
* WELL v2 -> Indoor VOC exposure

---

### Why these values matter

#### CO₂ (>1500 ppm)

* Indicates poor ventilation.
* Can cause drowsiness, headaches, reduced concentration, and cognitive decline.
* Recommended action: Increase fresh air and inspect HVAC.

#### High Temperature (>35°C)

* Indicates overheating or HVAC failure.
* May lead to dehydration and heat exhaustion.

#### Low Temperature (<10°C)

* Indicates heating failure.
* Increases discomfort and risk of hypothermia.

#### PM2.5 (>35 µg/m³)

* Indicates smoke or combustion.
* Fine particles reach deep into the lungs and bloodstream.
* Highest priority because it may indicate a fire.
* Recommended action: Evacuate immediately.

#### TVOC (>1000 ppb)

* Indicates chemical pollution (cleaning products, paints, solvents).
* Can cause eye irritation, headaches, dizziness, and Sick Building Syndrome.

---

## Engine 2 – Heuristic Rule-Based Alerts

### 1. What is Engine 2?

Engine 2 is the intelligent decision layer of our backend. Instead of relying on a single sensor reading, it analyzes 3-minute rolling statistics (Mean, StdDev, and Max) together with multiple sensor measurements to understand what is happening inside the room.

Its goal is to classify environmental events, reduce false alarms, and provide context-aware alerts.

---

### 2. Why do we need Engine 2?

Thresholds alone cannot distinguish between normal activities and real environmental problems.

For example:

* A person breathing near the sensor
* Steam from a hot cup of tea
* Perfume or sanitizer spray
* Dust disturbance
* Cleaning activity

All of these can temporarily change sensor values and may trigger false alarms.

Engine 2 solves this by analyzing patterns over time and correlating multiple sensors, allowing it to identify the actual cause of the environmental change.

---

### 3. Where did these heuristic rules come from?

Our heuristic rules are not arbitrary; they are derived from three scientific pillars:

#### Statistical Anomaly Detection (Z-Score Theory)
In signal processing, any sudden jump that goes more than 2 or 3 Standard Deviations above the rolling Average indicates a non-random physical disturbance. That is why our formulas check that the peak reading (`Max`) is greater than `Mean + (2 * StdDev)`.

#### Manufacturer Transducer Physics (Hardware Noise Floors)
Our minimum jump requirements (`like requiring at least +100 ppm for CO2 or +50 ppb for VOC`) come directly from the Sensirion and Adafruit hardware accuracy datasheets (`for example, SCD41 accuracy is plus or minus 40 ppm plus 5%`). This guarantees our rules never trigger on natural sensor noise or minor drift.

#### Empirical Sensor Fusion and Thermodynamics
Our multi-sensor correlations (`like separating hot tea from human breath by checking if CO2 variance is flat versus fluctuating`) are based on fundamental thermodynamics—steam from tea contains zero CO2, while human breath contains 40,000 ppm CO2. We calibrated and verified these exact rules during empirical lab testing of our edge nodes.

---

### 4. How does Engine 2 work?

#### Edge Node (nRF52840)

Every 6 seconds, the node samples environmental data.

Over 30 samples (3 minutes) it computes:

* Mean
* Standard Deviation (StdDev)
* Maximum (Max)

These rolling statistics are compressed into an ~800-byte CBOR packet and sent over the OpenThread mesh.

#### Backend (Spring Boot)

`AlertService.java` receives the packet and evaluates 8 heuristic rules using:

* Current value
* Mean
* StdDev
* Max

The backend also performs:

* Multi-sensor correlation
* Alert deduplication (5-minute debounce)
* MongoDB storage
* WebSocket notifications

---

### 5. Categorized Heuristic Rules

To keep our monitoring system organized and easy for facility managers to interpret, the 8 heuristic rules are grouped into three distinct functional categories based on how they interact with human activity and building physics:

#### 🟢 Category 1: Transient Human & Activity Bursts (`Short-Lived Spikes`)
These rules catch localized, short-lived disturbances that occur naturally during daily office or residential life, preventing them from triggering false building evacuation alarms:

| Heuristic Rule | Real-World Detection | Primary Sensors Involved | Alert Severity | Example Breakdown |
| :--- | :--- | :--- | :--- | :--- |
| **TRANSIENT_CO2_EVENT** | Exhaled human breath directly on sensor | CO₂ (`Max vs Mean + 2*StdDev`) | `INFO` | ✅ **See Example 1** |
| **TRANSIENT_VOC_EVENT** | Perfume, deodorant, or hand sanitizer spray | TVOC (`Max vs Mean + 1.5*StdDev`) | `INFO` | *(Similar to breath)* |
| **MOISTURE_EVENT** | Steam from hot tea, coffee cup, or kettle | Humidity (`Spike`) + CO₂ (`Flat variance`) | `INFO` | ✅ **See Example 3** |
| **PARTICULATE_EVENT** | Localized dust disturbance (`sweeping / clothing`) | PM2.5 (`Max vs Mean + 3*StdDev`) | `INFO` | ✅ **See Example 5** |

#### 🔵 Category 2: Building Ventilation & Environmental States (`Air Exchange & Occupancy`)
These rules track the macro-environmental state of the room to assist with automated energy management and air quality verification:

| Heuristic Rule | Real-World Detection | Primary Sensors Involved | Alert Severity | Example Breakdown |
| :--- | :--- | :--- | :--- | :--- |
| **VENTILATION_EVENT** | Exterior window opened (`rapid air flush`) | Temperature (`Drop`) + CO₂ (`Drop`) | `INFO` | ✅ **See Example 2 & 2B** |
| **OCCUPANCY_EVENT** | Continuous room occupancy | CO₂ (`Elevated Mean > 800 + Stable StdDev < 50`) | `INFO` | ✅ **See Example 4** |

#### 🔴 Category 3: Facilities Maintenance & Life Safety (`Multi-Sensor Hazard Correlation`)
These rules detect major chemical or physical hazards that require immediate facility intervention or building evacuation:

| Heuristic Rule | Real-World Detection | Primary Sensors Involved | Alert Severity | Example Breakdown |
| :--- | :--- | :--- | :--- | :--- |
| **CLEANING_EVENT** | Janitorial chemical cleaning | TVOC (`Spike`) + PM2.5 (`Spike`) | `INFO` (`Logged for tracking`) | *(Dual chemical/PM spike)* |
| **COMBUSTION_WARNING** | Early fire, smoke, or active burning | PM2.5 (`High`) + TVOC (`High`) + Temp (`Rising`) | `CRITICAL` (`Immediate Action`) | *(Life-Safety hazard)* |

---

### 6. Example 1 – Human Breath

#### 🗣️ What to say during presentation (What you speak out loud)
> *"Suppose someone breathes directly onto the CO₂ sensor. The instantaneous reading jumps sharply to 3500 ppm for a few seconds. Because our backend checks the 3-minute rolling average and variance, it knows the overall room air has not degraded. Instead of sounding a false building alarm, it logs a brief `TRANSIENT_CO2_EVENT` and suppresses further warnings."*

#### 🖥️ What to present on your slide
* **Scenario:** Person breathes directly onto CO₂ sensor (`3,500 ppm`).
* **Check:** High peak reading but normal 3-minute average (`890 ppm`).
* **System Action:** Suppresses evacuation alarm -> Logs `TRANSIENT_CO2_EVENT`.

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose someone breathes directly on the SCD41 sensor for 15 seconds.

* Current CO₂ = 3500 ppm
* Rolling Mean = 890 ppm
* Standard Deviation = 400 ppm

**Engine 1 checks (`HIGH_CO2` Warning conditions):**

* Current CO₂ > 1500 ppm ✅ *(True)*
* Rolling Mean > 1200 ppm ❌ *(False — 890 ppm is below 1200)*
* StdDev < 150 ppm ❌ *(False — 400 ppm shows high short-term volatility)*

Since the last two conditions fail, `HIGH_CO2` (building evacuation warning) is **NOT** generated.

**Engine 2 then checks (`Heuristic Rules`):**

* Very high CO₂ Maximum (`Co2Max > Mean + 2*StdDev`)
* Large difference between Maximum and Mean
* Reading quickly returns toward normal after the breath

It creates:

`TRANSIENT_CO2_EVENT (INFO)` — indicating a harmless localized burst rather than poor room ventilation.

---

### 7. Example 2 – Window Opened

#### 🗣️ What to say during presentation (What you speak out loud)
> *"When someone opens an exterior window, cooler outdoor air rushes into the room while outdoor fresh air dilutes indoor carbon dioxide. Because Engine 2 sees Temperature and CO₂ dropping at the exact same time, it correlates both sensors and classifies the event as a natural `VENTILATION_EVENT` rather than a heating system failure."*

#### 🖥️ What to present on your slide
* **Scenario:** Exterior window opened during afternoon.
* **Check:** Temperature and CO₂ drop simultaneously over 3 minutes.
* **System Action:** Correlates both sensors -> Logs `VENTILATION_EVENT`.

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose a window is opened during an active afternoon:

* Temperature drops from 22°C to 18°C
* CO₂ drops from 1100 ppm to 650 ppm

**Engine 1 checks (`TEMPERATURE_LOW` Threshold = < 10°C):**

* Current Temperature < 10°C ❌ *(False — 18°C is above the 10°C emergency limit)*

Since 18°C does not cross the life-safety threshold, Engine 1 stays silent.

**Engine 2 then checks (`Multi-Sensor Correlation Heuristics`):**

* Sudden thermal drop check: `Temp < Mean - (2 * TempStdDev)` ✅ *(True)*
* Simultaneous CO₂ dilution check: `CO2 < Mean - (1 * Co2StdDev)` ✅ *(True)*

It creates:

`VENTILATION_EVENT (INFO)` — proving that multi-sensor correlation recognizes physical room ventilation without requiring magnetic window contact sensors!

---

### 7B. Example 2B – Freezing Winter Air (< 10°C Emergency)

#### 🗣️ What to say during presentation (What you speak out loud)
> *"Now suppose a window is left wide open on a freezing winter night, or the building heating boiler fails completely. The room temperature drops to 7°C. In this case, Engine 1 immediately steps in because life safety is breached—it triggers a `TEMPERATURE_LOW` warning to prevent hypothermia and freezing pipes. At the exact same time, Engine 2 logs the rapid thermal drop and CO₂ dilution to tell building managers that the cold air is coming from an open window rather than a broken thermostat."*

#### 🖥️ What to present on your slide
* **Scenario:** Window left open during freezing sub-zero weather (`drops to 7°C`).
* **Engine 1 (Life Safety):** Triggers `TEMPERATURE_LOW` critical alarm (`< 10°C threshold`).
* **Engine 2 (Diagnostic):** Correlates Temp + CO₂ drop -> Logs `VENTILATION_EVENT` (`open window`).

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose an exterior window is left open during freezing winter sub-zero weather for 15 minutes:

* Temperature drops from 19°C to 7°C
* CO₂ drops from 950 ppm to 420 ppm (ambient outdoor level)

**Engine 1 checks (`TEMPERATURE_LOW` Threshold = < 10°C):**

* Current Temperature < 10°C ✅ *(True — 7°C is strictly below the 10°C ASHRAE 55 emergency boundary)*

Action: Engine 1 immediately generates a `TEMPERATURE_LOW (WARNING/CRITICAL)` alert! This provides immediate life-safety and pipe-freeze protection.

**Engine 2 then checks (`Heuristic Context`):**

* Sudden thermal drop check: `Temp < Mean - (2 * TempStdDev)` ✅ *(True)*
* Simultaneous CO₂ dilution check: `CO2 < Mean - (1 * Co2StdDev)` ✅ *(True)*

Action: Engine 2 classifies and logs `VENTILATION_EVENT (INFO)`.

**Why having BOTH engines here is genius:**
Engine 1 alerts security/maintenance that the room is dangerously freezing (`7°C`), while Engine 2 gives them the diagnostic root cause (`VENTILATION_EVENT` — meaning someone left the exterior window wide open!).

---

### 8. Example 3 – Hot Tea vs Human Breath

#### 🗣️ What to say during presentation (What you speak out loud)
> *"Suppose someone sets a steaming hot cup of tea right next to the node, or someone stands near the sensor and breathes. Both actions cause a sudden spike in relative humidity. To avoid confusing them, Engine 2 cross-checks Carbon Dioxide variance (`Standard Deviation`). Because steam from hot tea contains pure water vapor with zero carbon dioxide (`CO₂ variation < 10 ppm`), our backend correctly classifies it as a `MOISTURE_EVENT` (`steam`). If CO₂ variation were jumping wildly, it would know a person was exhaling!"*

#### 🖥️ What to present on your slide
* **Scenario:** Steam from hot tea vs human breath (`both spike humidity`).
* **Check:** Evaluates CO₂ Standard Deviation during humidity jump.
* **System Action:** Flat CO₂ variance (`pure steam`) -> Logs `MOISTURE_EVENT`.

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose a hot cup of tea is placed near the `SCD41` sensor:

* Relative Humidity jumps from 45% to 65% (`HumidityMax = 65%`, `Mean = 46%`, `StdDev = 4%`)
* CO₂ remains flat and steady (`CO2Mean = 600 ppm`, `CO2StdDev = 3 ppm`)

**Engine 1 checks (`Life-Safety Thresholds`):**

* No emergency thermal or gas thresholds breached ✅ *(Engine 1 stays silent)*

**Engine 2 then checks (`MOISTURE_EVENT Heuristic Rule in AlertService.java`):**

* Humidity spike check: `Humidity > Mean + Math.max(3 * HumidityStdDev, 5.0)` -> `65% > 46% + 12% (58%)` ✅ *(True — sudden moisture burst)*
* Thermodynamic gas cross-check: `Co2StdDev < 10.0` -> `3 ppm < 10 ppm` ✅ *(True — proving the moisture burst has zero metabolic CO₂)*

It creates:

`MOISTURE_EVENT (INFO)` — proving how multi-sensor cross-correlation uses basic physics to separate hot beverages from human respiration!

---

### 9. Example 4 – Occupancy Detection

#### 🗣️ What to say during presentation (What you speak out loud)
> *"Our fourth example is camera-free occupancy detection. When people sit down inside a room, their respiration raises the carbon dioxide average above 800 ppm, but because nobody is breathing directly on the sensor, the reading remains stable (`low variance`). By checking for elevated average CO₂ combined with low standard deviation, Engine 2 confirms continuous human occupancy without requiring privacy-invasive cameras or passive infrared motion sensors!"*

#### 🖥️ What to present on your slide
* **Scenario:** Camera-free room occupancy detection.
* **Check:** Elevated CO₂ baseline (`> 800 ppm`) with stable variance (`StdDev < 50 ppm`).
* **System Action:** Confirms continuous human presence -> Logs `OCCUPANCY_EVENT`.

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose 4 people sit inside a conference room for 30 minutes:

* CO₂ stabilizes around 920 ppm (`CO2Mean = 920 ppm`, `CO2StdDev = 15 ppm`)

**Engine 1 checks (`HIGH_CO2` Threshold = > 1500 ppm):**

* Current CO₂ > 1500 ppm ❌ *(False — 920 ppm is well below the 1500 ppm evacuation boundary)*

Since 920 ppm is safe under ASHRAE 62.1 limits, Engine 1 stays silent.

**Engine 2 then checks (`OCCUPANCY_EVENT Heuristic Rule in AlertService.java`):**

* Elevated CO₂ baseline check: `Co2Mean > 800.0` -> `920 ppm > 800 ppm` ✅ *(True — confirming occupancy)*
* Stable variance check: `Co2StdDev < 50.0` -> `15 ppm < 50 ppm` ✅ *(True — proving steady room-wide respiration rather than a direct breath spike)*

It creates:

`OCCUPANCY_EVENT (INFO)` — confirming continuous human occupancy through pure gas dynamics!

---

### 10. Example 5 – Dust Disturbance vs Fire Hazard (PARTICULATE_EVENT)

#### 🗣️ What to say during presentation (What you speak out loud)
> *"Our fifth example shows how our backend distinguishes between simple house dust and a real fire. If a janitor sweeps the floor or shakes out a dusty rug near the sensor, PM2.5 jumps sharply to 65 micrograms. A simple smoke detector would immediately trigger a building fire alarm! But Engine 2 checks our 3-sigma statistical rule combined with multi-sensor cross-correlation. Because the three-minute rolling average is low and neither temperature nor chemical VOCs rose, our backend knows there is no combustion—it logs a clean `PARTICULATE_EVENT` and prevents a false fire evacuation!"*

#### 🖥️ What to present on your slide
* **Scenario:** Dust from sweeping or shaking clothing (`PM2.5 jumps to 65 μg/m³`).
* **Check:** 3-Sigma particulate spike (`Max > Mean + 3*StdDev`) with flat TVOC & Temperature.
* **System Action:** Suppresses fire evacuation alarm -> Logs `PARTICULATE_EVENT`.

---

#### 🔍 Technical Details & Math (For your deep understanding & Q&A)

Suppose a janitor sweeps the floor right in front of the `SPS30` optical particulate sensor:

* PM2.5 jumps sharply (`PmMax = 65 μg/m³`, `Mean = 12 μg/m³`, `StdDev = 16 μg/m³`)
* TVOC and Temperature remain flat and normal (`No thermal/chemical signs of fire`)

**Engine 1 checks (`PM2.5` Threshold = > 35 μg/m³):**

* Rolling Mean > 35 μg/m³ ❌ *(False — rolling mean of 12 μg/m³ proves the overall room air is clean)*

**Engine 2 then checks (`PARTICULATE_EVENT Heuristic Rule in AlertService.java:100`):**

* 3-Sigma spike check above 5.0 μg/m³ noise floor: `PmMax > Mean + Math.max(3 * PmStdDev, 5.0)` -> `65 > 12 + 48 (60)` ✅ *(True — localized dust cloud detected)*
* Multi-Sensor cross-check (`AlertService.java:187`): Because TVOC and Temperature did **NOT** rise simultaneously, `COMBUSTION_WARNING (CRITICAL)` (`fire alarm`) is **NOT** triggered!

It creates:

`PARTICULATE_EVENT (INFO)` — proving how 3-sigma Z-Score math and multi-sensor correlation prevent everyday house dust from triggering false fire alarms!

---

### Closing Statement for Engine 2

Engine 2 complements Engine 1 by using rolling statistics and multi-sensor correlation to explain why an environmental change occurred. This reduces false alarms, preserves privacy, and provides intelligent, context-aware indoor monitoring.

---

## Why Our Implementation is More Robust

Our implementation is more robust than a traditional threshold-only monitoring system because it combines internationally recognized safety thresholds with rolling statistical analysis, multi-sensor correlation, hardware health monitoring, and alert deduplication. This significantly reduces false alarms while maintaining fast detection of genuine hazardous conditions.
