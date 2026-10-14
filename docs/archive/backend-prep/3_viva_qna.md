# 🎙️ Backend Alert Engine — Master Viva & Defense Q&A

*Note: This document contains exact, punchy 15-to-30 second spoken answers and mathematical defenses for every question evaluators might ask about your Spring Boot Backend (AlertService.java). All inline code backticks have been removed for clean PDF conversion.*

---

## Q1: "Why did you use rolling Z-scores instead of just setting fixed upper limits across the board?"

* **Core Formula:**
```sql
Peak Reading > Rolling Mean + (2 * Rolling Standard Deviation)
```
* **Spoken Defense:** "Because fixed limits suffer from constant false positives and false negatives. If a conference room naturally sits at 900 ppm during a meeting, a localized breath spike to 1,200 ppm shouldn't trigger a whole-floor evacuation. By checking Z-scores where the maximum reading exceeds the rolling mean plus two standard deviations, our engine adapts dynamically to any room's baseline while reliably catching unusual localized spikes."

---

## Q2: "Where do the multipliers 2x, 3x, and 1.5x come from? Did you get them from the sensor datasheet?"

* **Core Formula Anatomy:**
```sql
Peak Reading > Rolling Average + MAX ( Z * Standard Deviation , Hardware Noise Floor )
                                       [---------------------]   [------------------]
                                         Statistical Theory        Datasheet Spec
```
* **Spoken Defense:** "We got the absolute noise floors directly from manufacturer datasheets, while the multipliers come from statistical signal processing theory. Datasheets do not specify anomaly detection algorithms—that is our custom intelligent software layer. Using the Gaussian Bell Curve, 2-sigma covers 95.4 percent of normal room variance, while 3-sigma covers 99.7 percent. For Total VOCs, we use 1.5-sigma because metal-oxide chemical sensors have slow absorption kinetics, producing a gentle rise rather than a sharp physical spike."

### Origin Defense Summary Table
| Formula Component | Value Used | Source & Origin | Engineering Justification |
| :--- | :--- | :--- | :--- |
| **Z-Multipliers (3, 2, 1.5)** | `3x, 2x, 1.5x` | **Statistical Bell Curve Law** | `3x` (99.7%) for dust/tea, `2x` (95.4%) for breath/windows, `1.5x` for slow TVOC gas kinetics. |
| **Hardware Noise Floors** | `100 ppm / 5 ug / 25 ppb / 0.2 C` | **Manufacturer Datasheets** | Directly from `Sensirion (SCD41/SPS30)` & `ScioSense (CCS811)` accuracy specs to stop quiet-room false alarms. |

---

## Q3: "How do you prevent natural sensor noise from triggering false alerts during quiet hours?"

* **Core Formula:**
```sql
Hardware Noise Floor Limit = MAX ( 2.0 * Rolling CO2 Standard Deviation , 100.0 ppm )
```
* **Spoken Defense:** "We built manufacturer hardware accuracy limits directly into our backend logic as statistical noise floors. For example, Sensirion SCD41 accuracy is plus or minus 40 ppm plus 5 percent of reading. In our Java code, we enforce a minimum variance floor of 100 ppm for CO2 and 25 ppb for VOCs. This guarantees our formulas never trigger on natural sensor drift or electrical jitter."

---

## Q4: "What happens right now if I hold a lighter or spray cologne near your sensor node?"

* **Core Formula:**
```sql
Transient VOC Spike: TVOC Peak > Rolling Mean + Math.max(1.5 * TVOC StdDev, 25.0 ppb)
Critical Fire Alarm: PM2.5 > 35 ug/m3 AND TVOC > 1000 ppb AND Temperature > Rolling Mean + (2 * Temp StdDev)
```
* **Spoken Defense:** "It depends on how long you hold it! If you flick the lighter briefly near our gas sensor, our system catches the butane hydrocarbon burst and logs a transient VOC event without sounding a false fire alarm. However, if you hold the burning lighter near the node for 15 seconds, our multi-sensor fusion sees particulate soot, chemical VOCs, and rising thermal heat spike together, instantly firing our highest-priority critical combustion warning to evacuate the building."

---

## Q5: "How does Engine 1 work alongside Engine 2 without clashing or duplicating alerts?"

* **Core Formula:**
```sql
Engine 1: 5-Second Static Checks (CO2 > 1500 ppm, Temp > 35 C, PM2.5 > 35 ug/m3)
Engine 2: 180-Second Rolling Heuristics (Multi-Sensor Correlations & Z-Scores)
```
* **Spoken Defense:** "Engine 1 acts as our instant life-safety circuit breaker, evaluating raw readings every 5 seconds against ASHRAE and WHO health limits. Engine 2 acts as our intelligent diagnostician, analyzing 3-minute rolling trends to explain what caused the change. They work in tandem: if a winter window breaks, Engine 1 sounds an immediate low-temperature hazard while Engine 2 correlates the simultaneous CO2 drop to tell maintenance staff that an open window is the exact root cause."

---

## Q6: "Why did you use MongoDB for alert storage instead of a relational SQL database?"

* **Core Formula:**
```sql
5-Minute Debounce Check: Current Timestamp - Last Alert Timestamp < 300 seconds
```
* **Spoken Defense:** "Because IoT telemetry produces high-velocity, flexible time-series data. Each alert type contains different metadata context—a fire warning stores temperature and particulate readings, while a ventilation event stores thermal drop rates and CO2 dilution curves. MongoDB document storage accommodates these heterogeneous payloads without rigid SQL joins, while allowing our AlertRepository to execute ultra-fast 5-minute debounce window checks to prevent database flooding."
