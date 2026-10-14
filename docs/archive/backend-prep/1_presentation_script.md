# Backend Alert Engine: Presentation & Viva Scripts Only (PDF Ready)

*Note: This document contains strictly your spoken scripts for your 15-minute presentation and Q&A defense. All conversational backticks have been removed so this converts into a clean, compact 2-to-3 page PDF with zero pink highlight boxes.*

---

## Part 1: The 3-Minute Master Presentation Speech (The Rule of 3 Story)

When you reach the backend portion of your 15-minute presentation, speak these exact three paragraphs with a natural, conversational tone:

### Chapter 1 — The Problem 
"Now moving to the backend portion of our architecture: When raw telemetry arrives at our Spring Boot server from the edge nodes, if we only used simple fixed thresholds like a normal building thermostat, our system would be unusable. Our dashboard would be flooded with false alarms every time someone breathes directly near a sensor, sets down a hot cup of tea, or sweeps dust across the floor."

### Chapter 2 — The Solution: Our Dual-Engine Architecture 
"To solve this, I designed and implemented a Dual-Engine alerting system in our backend services. Engine 1 handles immediate life-safety protection by continuously checking sensor streams against strict international standards from ASHRAE, the World Health Organization, and EPA. Engine 2 is our heuristic diagnostic engine. It continuously evaluates 3-minute rolling statistical Z-scores — specifically the mean and standard deviation — along with multi-sensor cross-correlation to diagnose exactly what is happening in the room and why."

### Chapter 3 — Two Killer Real-World Proofs 
"Let me share two real-world examples to prove how powerful this dual-engine approach is:

First, imagine an exterior window left wide open on a freezing winter night where the room temperature drops to 7 degrees Celsius. Engine 1 immediately triggers a critical low-temperature alarm to prevent hypothermia and freezing pipes. At the exact same time, Engine 2 correlates that sudden thermal drop with simultaneous Carbon Dioxide dilution, creating a ventilation event to tell building managers the exact root cause: someone left the window wide open!

Second, consider separating hot tea from human breath. Both actions cause a sudden relative humidity jump above 60 percent. To avoid confusing them, Engine 2 cross-checks Carbon Dioxide standard deviation. Because steam from tea is pure water vapor with almost zero CO2 variation, our backend classifies it safely as a moisture event. If CO2 variance were jumping wildly, our backend would know a person was exhaling right near the node."

---

## Part 2: Quick-Talk Scripts & Formulas for All 6 Real-World Examples

If an evaluator asks you directly about any specific scenario, use these exact formulas and 15-second spoken explanations:

### 1. Human Breath (Transient CO2 Event)
* **Core Formula:**
```sql
CO2 Peak > Rolling Average + MAX(2 * CO2 Standard Deviation, 100 ppm) AND Current CO2 recovers toward Average within 3 minutes
```
* **Spoken Script:** "If someone breathes directly onto the CO2 sensor, instantaneous readings jump above 3,500 ppm. Because our backend checks the 3-minute rolling average and standard deviation, it knows the overall room air has not degraded. Instead of sounding a false building evacuation alarm, Engine 2 logs a brief transient CO2 event and suppresses further warnings."

### 2. Window Opened (Ventilation Event)
* **Core Formula:**
```sql
Temperature < Rolling Average - (2 * Temperature Standard Deviation) AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)
```
* **Spoken Script:** "When someone opens an exterior window, cooler outdoor air rushes into the room while outdoor fresh air dilutes indoor carbon dioxide. Because Engine 2 sees temperature and CO2 dropping at the exact same time, it correlates both sensors and classifies the event as a natural ventilation event rather than a heating system failure."

### 3. Freezing Winter Window (< 10 Degrees Celsius Emergency)
* **Core Formula:**
```sql
Current Temperature < 10 C AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)
```
* **Spoken Script:** "If a window is left open during sub-zero winter weather and the room drops below 10 degrees, Engine 1 immediately triggers a critical low-temperature warning to protect life safety and pipes. Meanwhile, Engine 2 correlates the thermal drop and CO2 dilution to tell maintenance staff to close the open window instead of wasting hours inspecting the heating boiler."

### 4. Hot Tea vs Human Breath (Moisture Event)
* **Core Formula:**
```sql
Humidity Peak > Rolling Average + MAX(3 * Humidity Standard Deviation, 5 %RH) AND CO2 Standard Deviation < 10 ppm
```
* **Spoken Script:** "Both steaming hot tea and human breath cause a sharp relative humidity spike. To separate them, Engine 2 checks Carbon Dioxide variance during the humidity jump. If CO2 variance remains flat under 10 ppm, it knows the burst is pure water vapor from tea and logs a harmless moisture event."

### 5. Dust Sweeping vs Fire Hazard (Particulate Event)
* **Core Formula:**
```sql
PM2.5 Peak > Rolling Average + MAX(3 * PM2.5 Standard Deviation, 5 ug/m3) AND TVOC Variance < 50 ppb AND Temperature Variance < 0.5 C
```
* **Spoken Script:** "If a janitor sweeps the floor or shakes out dusty clothing, PM2.5 jumps sharply above 60 micrograms per cubic meter. A simple smoke detector would immediately trigger a building fire alarm! But Engine 2 checks our 3-sigma statistical check alongside chemical and thermal sensors. Because TVOC and temperature remained flat, our backend knows there is no combustion and logs a clean particulate event."

### 6. Camera-Free Occupancy Detection (Occupancy Event)
* **Core Formula:**
```sql
CO2 Rolling Average > 800 ppm AND CO2 Standard Deviation < 50 ppm
```
* **Spoken Script:** "When people sit inside a conference room, steady respiration raises average CO2 above 800 ppm while standard deviation remains low and stable under 50 ppm. By checking for elevated baseline combined with low variance, Engine 2 confirms continuous human occupancy without requiring privacy-invasive cameras or motion sensors."




