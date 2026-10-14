# Environmental Heuristics: Presentation Guide

### Slide 1: Opening Agenda & Motivation ("Why & What We Will Discuss")
* **Why We Built This System (Motivation):**
  * Traditional indoor monitoring relies on single-parameter static thresholds (e.g., `CO2 > 1000 = Alarm`).
  * If a student simply leans over a desk sensor and exhales, a static threshold triggers a false building emergency! This creates severe **alarm fatigue** for facility operators.
* **What We Are Going To Discuss Today (Agenda):**
  1. **Our Dual-Engine Architecture:** How we combine Python unsupervised ML (`IsolationForest`) for unknown anomalies with a Java backend (`AlertService.java`) for domain heuristics.
  2. **Our 7 Statistical Heuristics across 3 Physical Rules:** How we classify complex indoor events using 27 rolling averages (`Mean, StdDev, Max`).
  3. **Our Real-World Deployment Verification:** Our live dual-node stress test inside a residential bedroom (`node-e9b1`) and a packed university lecture hall (`node-0587`).

---

### Slide 2: Category 1 — Transient Spikes
* **The Rule:** The sensor value exhibits a rapid spike followed by immediate recovery to baseline (`Spike & Recovery`).

<br/>

* **Event 1 — Direct Breath (`TRANSIENT_CO2_EVENT`):** Someone breathes right onto the `SCD41` sensor (`CO2Max > Mean + 2*Std`). Because it quickly recovers below the mean, no alarm is fired!
* **Event 2 — Perfume / Aerosols (`TRANSIENT_VOC_EVENT`):** Someone sprays perfume or applies hand sanitizer near the `CCS811` sensor (`TVOC > Mean + 1.5*Std`).
* **Event 3 — Dust Disturbance (`PARTICULATE_EVENT`):** Shaking a cloth over the `SPS30` optical sensor (`PM2.5 > Mean + 3*Std`).

---

### Slide 3: Category 2 — Multi-Sensor Shifts
* **The Rule:** Correlating **two independent sensors** simultaneously to eliminate single-sensor false positives.

<br/>

* **Event 4 — Window Draft (`VENTILATION_EVENT`):** How do we know a window opened? Both **Temperature AND CO2 drop together** below their rolling averages (`< Mean - 2*Std`).
* **Event 5 — Active Cleaning (`CLEANING_EVENT`):** Janitors wiping desks while spraying cleaner. Both **VOC AND PM2.5 spike simultaneously**.
* **Event 6 — Hot Drink vs. Breath (`MOISTURE_EVENT`):** How to tell hot tea from human breath? Both make humidity rise, but only breath releases CO2! So our rule checks: **Humidity rises sharply while CO2 variance stays near zero (`Co2Std < 10`)**.

---

### Slide 4: Category 3 — Sustained State & Noise Floors
* **The Rule:** Tracking **long-term variance stability (`StdDev`)** to detect sustained room presence without false alarms.

<br/>

* **Event 7 — Presence Detection (`OCCUPANCY_EVENT`):**
  * We turn the `SCD41` CO2 sensor into a **camera-less human presence detector**.
  * When humans sit in a closed room, CO2 climbs and plateaus.
  * Our check: **`CO2Mean > 800 ppm` AND stable variance (`CO2Std < 50`)**. Low variance proves it’s real, stable occupancy!
* **Hardware Noise Floors:** Across all 7 rules, we enforce strict minimum jumps (`25 ppb` for VOC, `5 µg/m³` for PM2.5, `0.8°C` for Temp) so electrical jitter never triggers false events.

---

### Slide 5: Real-World Verification — The July 2 Lecture Proof
*(Tell this exact real-world story with confidence—examiners love real data!)*
* **Our Dual-Node Test:** We verified our code across a private bedroom (`node-e9b1`) and a packed university lecture hall (`node-0587`).
* **The July 2 Lecture Hall Story (`node-0587`):** On July 2nd, the sensor was on a desk in a hall of ~40 students. Look what our live UI captured:
  1. **At 12:46 PM as 40 students walked in:** `TRANSIENT_VOC_EVENT` fired automatically! The sensor detected ambient perfumes and alcohol hand sanitizers brought in by the crowd.
  2. **At 12:51 PM, 01:32 PM, and 01:39 PM:** I performed manual breath exhalation tests right over the hardware. Every time, `TRANSIENT_CO2_EVENT` fired exactly as designed and marked as `Recovered` minutes later!
  3. **At 01:35 PM (~50 minutes into the lecture):** `OCCUPANCY_EVENT` fired automatically as the 40 students' respiration reached a steady metabolic plateau (`StdDev < 50`)!
* **Bedroom Proof (`node-e9b1`):** Window drafts (`VENTILATION_EVENT`) and hot tea cups (`MOISTURE_EVENT`) verified naturally in our residential telemetry.

---

### Slide 6: Summary & Transparency
* **Total Scorecard:** 
  * **5 of 7 events verified in live production** across our bedroom and lecture hall deployments (`Occupancy, Breath CO2, VOC Aerosols, Ventilation Draft, Moisture`).
  * **2 events (`Particulate Disturbance` & `Active Cleaning`) are fully coded and compiled** in `AlertService.java:102, 162`. Physical smoke/chemical testing has not been performed yet to avoid disturbing air quality, designating them as ready algorithmic capabilities.
* *"Thank you! I am ready for your questions."*

---

## ⚡ Master Viva & Technical Defense Cheat-Sheet (`9 Bulletproof Answers`)

When the professor, TA, or external examiner asks tough technical questions during your oral viva or presentation Q&A, use these punchy, technically rigorous answers:

### 1. Q: *"Where do your exact static threshold numbers ($1,500\text{ ppm}$ $\text{CO}_2$, $35\ \mu\text{g/m}^3$ $\text{PM}_{2.5}$, $35/10^\circ\text{C}$ Temp, $20\%/60\%$ RH Humidity, $1,000\text{ ppb}$ TVOC) come from, and where are they configured?"*
* **Answer:** *"They are NOT arbitrary numbers! They match real, independently-verified guidelines: the **ASHRAE Position Document on Indoor Carbon Dioxide** (2025) for the $>1,500\text{ ppm}$ $\text{CO}_2$ threshold — this sits at the upper end of the ~1000–1500 ppm international guideline range compiled by ISIAQ (we deliberately moved off ASHRAE 62.1, since ASHRAE's own position document explicitly states 62.1 does not set a CO2 limit at all); **ASHRAE 55** ($>35^\circ\text{C}$ or $<10^\circ\text{C}$ Temp, our own conservative bounds beyond ASHRAE 55's actual 20–26°C comfort zone); the **OSHA Technical Manual** ($20\%$–$60\%$ RH Humidity, matching OSHA's stated humidity-control range word for word); **EPA NAAQS** ($>35\ \mu\text{g/m}^3$ $\text{PM}_{2.5}$, verified directly against the EPA's own 24-hour standard); and **WELL v2** ($>1,000\text{ ppb}$ TVOC, a conservative threshold set above WELL's 500 µg/m³ continuous-monitoring concern level). In our backend code, they are dynamically bound to `AlertService.java` via `@Value("${app.alerts.*}")` properties inside `application.yml` (`co2-max: 1500.0`, `pm25-max: 35.0`, `temperature-max: 35.0`, `temperature-min: 10.0`, `humidity-max: 60.0`, `humidity-min: 20.0`, `tvoc-max: 1000.0`)."*

### 2. Q: *"You have a static Humidity threshold (`> 60%` / `< 20%`) — why do you also need a separate dynamic Moisture-Event heuristic?"*
* **Answer:** *"They catch different things. The static bound (`humidityMax`/`humidityMin` in `AlertService.java`) is a hard life-safety floor sourced from the OSHA Technical Manual, which states humidity control should stay in the 20%-60% RH range — it fires only once the room genuinely crosses that line. But a real leak or steam event needs to be caught long before humidity climbs all the way to 60%. That's what our Engine 2 heuristic (`MOISTURE_EVENT` in `AlertService.java`) is for: it checks for a rapid, localized $+6\%$ RH deviation above the rolling mean — clamped to the SCD4x sensor's own ±6% RH accuracy floor so electrical jitter can't trigger it — while confirming $\text{CO}_2$ variance stays flat ($\text{CO}_{2\text{Std}} < 10\text{ ppm}$) so it isn't fooled by human breath. The two layers are complementary: one is an absolute safety ceiling, the other catches the transient event well before the room ever gets there."*

### 3. Q: *"How does your backend specifically diagnose and handle physical hardware sensor failures versus environmental alarms?"*
* **Answer:** *"Our Java ingestion engine (`AlertService.java:47`) checks for two layers of hardware faults:
  1. **Sentinel Value (`-999.0`)**: If any sensor outputs $\le -900.0$, the backend immediately isolates it from environmental evaluation.
  2. **Bitmask Decoding (`healthStatus`)**: It decodes the 8-bit integer bitmask (`Bit 0 == 0` for `SCD41 Temp/Hum`, `Bit 1 == 0` for `SCD41 CO2`, `Bit 2 == 0` for `SPS30 Particulates`, `Bit 3 == 0` for `CCS811 TVOC`) and generates a targeted `HARDWARE_FAULT` critical alert (`e.g., 'Verify CO2 sensor I2C connection'`).
  3. **Self-Healing Logic**: Once the physical issue is fixed and the node reports `healthStatus == 255` (`0xFF`), our backend **automatically finds the latched fault row in MongoDB and marks `resolved = true`**."*

### 4. Q: *"How do you prevent activity feed flooding or database spam when your sensors sample every few seconds?"*
* **Answer:** *"Our backend enforces a 2-tier deduplication architecture (`AlertService.java:420-432`):
  * **For `INFO` (Heuristic Events like `TRANSIENT_CO2` or `OCCUPANCY_EVENT`):** We enforce a **5-minute (300-second) distributed debounce timer** per node (`findFirstByNodeIdAndTypeOrderByCreatedAtDesc`). If the exact same event occurred within the last 300 seconds, the new record is suppressed.
  * **For `WARNING` / `CRITICAL` Alerts (`HIGH_CO2`, `HARDWARE_FAULT`):** We check if an **unresolved** alert already exists (`findFirstByNodeIdAndTypeAndResolvedFalse`). If one is already active, no new database rows are created, ensuring a continuous overheating issue results in exactly one latched warning."*

### 5. Q: *"Why run these 8 multi-sensor heuristic rules on the Java server (`AlertService.java`) instead of the `nRF52840` microcontroller?"*
* **Answer:** *"Our `nRF52840` firmware efficiently calculates the 3-minute rolling window statistics (`Mean, StdDev, Max`) directly on the edge board and sends them inside our 800-byte CBOR packets (`cbor2`). However, evaluating multi-packet historical trends, running the 300-second distributed debounce timer against MongoDB, and triggering instant WebSocket UI updates require centralized state and database access. Furthermore, running rules on our Spring Boot backend allows administrators to dynamically adjust alert thresholds (`application.yml`) without re-compiling C++ firmware or re-flashing 50+ embedded wireless mesh nodes!"*

### 6. Q: *"Why use Java heuristics (`AlertService.java`) if you already have Python Machine Learning (`IsolationForest`)?"*
* **Answer:** *"Python `IsolationForest` gives unsupervised outlier scores (`is_anomaly = True`) based on high-dimensional deviation, but an unsupervised algorithm does not understand human domain concepts. Java heuristics provide deterministic, explainable domain context (`'Window opened'`, `'Janitorial cleaning'`, `'Room occupied'`). They work together symmetrically as Layer 1 (Unsupervised ML Anomaly Detection) and Layer 2 (Explainable Multi-Sensor Heuristics)."*

### 7. Q: *"What exact compression do you use for your data payloads over the air, and why?"*
* **Answer:** *"We use **Concise Binary Object Representation (`CBOR`) over CoAP (UDP)**. If we transmitted raw JSON containing all 27 rolling statistical features (`Mean, StdDev, Max`), the payload size exceeded 4,000 bytes. By packing the metrics into binary `CBOR` (`cbor2`), we reduced the payload size by over **80% down to roughly 800 bytes**, which easily fits within our low-power OpenThread mesh buffer bounds (`IEEE 802.15.4`) and dramatically extends battery life."*

### 8. Q: *"How does the Gateway handle microcontroller hardware clock drift (`oscillator drift`) over weeks of continuous uptime?"*
* **Answer:** *"Constrained microcontrollers (`nRF52840`) report a monotonic millisecond counter (`uptimeMs`) without a battery-backed RTC. Over weeks, internal RC oscillators drift. Our Python middleware (`queue_manager.py`) implements a **Dynamic Live Anchor Algorithm**: when a live packet arrives (`uptime >= max_uptime - 2000`), the gateway stamps it with exact current UTC time (`now.isoformat()`) and dynamically recalculates the anchor (`known_boot_time = now - uptime`). Relative timestamp reconstruction is reserved strictly for historical backlogged packets buffered during offline outages."*

### 9. Q: *"If a sensor completely freezes and outputs the exact same reading (`e.g., 400 ppm CO2`) continuously, how does your system catch it?"*
* **Answer:** *"A frozen sensor outputs a number $> -900.0$, so simple threshold and `-999.0` checks will miss it. However, because our edge node continuously calculates rolling standard deviation over 30 samples, our backend inspects the variance (`AlertService.java:66`). If $\text{StdDev} == 0.0$ while the mean is positive (`TVOCStd == 0.0 && TVOCMean > 0`), the backend catches the flatline and triggers a `HARDWARE_FAULT` critical alert (`'Sensor standard deviation is perfectly zero. Sensor may be frozen'`)."*
