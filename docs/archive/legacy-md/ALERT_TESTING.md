# Smart Monitoring Alert Testing Guide

This document outlines the physical procedures required to test the various alert thresholds and anomaly detection logic implemented in the Smart Monitoring system (`AlertService.java`).

> [!NOTE]
> The backend `AlertService` implements a 5-minute anti-spam timer for `INFO` level events. If you trigger an `INFO` event (like a transient VOC or Particulate spike), you must wait at least 5 minutes before that exact same event type can be triggered again. However, clicking the **"Clear Feed"** button on the UI instantly resets this backend timer so you can test again immediately!

> [!TIP]
> **Hardware Noise Floors:** To prevent false positives from microscopic electronic noise, the backend enforces a minimum absolute jump (based directly on the hardware accuracy limits of the `SCD41` and `SPS30` sensors). Your physical test must cause the sensor to jump by at least these amounts to trigger an event:
> - **TVOC:** Jump of at least `25 ppb` (CCS811)
> - **Particulates (PM2.5):** Jump of at least `5.0 µg/m³` (SPS30 accuracy limit)
> - **Ventilation:** Temp drop of `0.5°C` **AND** CO₂ drop of `30 ppm` (SCD41 accuracy limit)
> - **Moisture:** Humidity jump of `5.0%` (SCD41 accuracy limit)

---

## CCS811 (TVOC)

### 1. Transient VOC Event (INFO)
**How it works:** Detects a sudden spike and recovery in TVOC levels (like perfume, spray, or human breath).
**How to test:**
1. Briefly spray a small amount of deodorant, perfume, or air freshener near the sensor, OR breathe heavily on it.
2. Wait a few seconds for the TVOC to spike, then let the air clear.
3. The alert will trigger once the reading drops back down near the baseline.

### 2. Sustained Environmental Change (WARNING)
**How it works:** Detects persistently high VOCs (`TVOC > 1000 ppb`) indicating a chemical spill, heavy cleaning, or poor ventilation.
**How to test:** 
1. Open a bottle of hand sanitizer, rubbing alcohol, or perfume.
2. Leave it sitting a few inches away from the sensor for 1-2 minutes. 
3. Unlike a short spray or breath (which triggers a transient alert), this creates a *sustained* high reading that triggers the warning.

---

## SPS30 (Particulates)

### 3. Transient Particulate Event (INFO)
**How it works:** Detects a sudden spike and recovery in PM2.5 levels.
**How to test:** 
1. Shake a dusty cloth, clap dusty hands, or light a match and blow it out immediately near the sensor. 
2. Wait about 30 seconds for the dust/smoke to settle.
3. The alert will trigger once the backend detects the PM2.5 levels recovering to normal.

---

## SCD41 (Temperature & CO2)

### 4. Occupancy Event (INFO)
**How it works:** Detects when someone is steadily in the room by looking for elevated, stable CO2 levels (`CO2 > 800 ppm` with low variance).
**How to test:** 
1. Stay in a small, closed room with the sensor for a few minutes.
2. Wait until the CO2 rises above 800 ppm. 
3. Once the level stops fluctuating rapidly and stabilizes, it will trigger an occupancy event.

### 5. Rapid Ventilation Event (INFO)
**How it works:** Detects a sudden drop in both Temperature (`-0.5°C`) and CO2 (`-50 ppm`), indicating fresh air is flowing in.
**How to test:** 
1. Ensure the room is warm and has a slightly elevated CO2 level (e.g., after the Occupancy test).
2. Open a window next to the sensor or point a fan at it blowing cooler, fresh air.

### 6. Temperature Thresholds (WARNING)
**How it works:** Detects extreme temperatures (`> 35°C` or `< 10°C`).
**How to test High Temp:** Gently blow warm air from a hairdryer onto the sensor from a distance.
**How to test Low Temp:** Place an ice pack nearby (without getting the electronics wet).

---

## Multiple Sensors / System Level

### 7. Combustion Warning (CRITICAL)
**Sensors:** `SPS30`, `CCS811`, `SCD41` (PM2.5, TVOC, Temperature)
**How it works:** Detects a simultaneous spike in PM2.5 (`> 35 µg/m³`), TVOC (`> 1000 ppb`), and a sudden rise in Temperature.
**How to test:** 
> [!WARNING]
> Please be careful not to melt your 3D printed case or burn the jumper wires!
1. Light a match or lighter.
2. Hold it a few inches underneath the sensor for several seconds, letting the smoke and heat hit the sensors.

### 8. Hardware Fault (CRITICAL)
**Sensors:** All (`SCD41`, `SPS30`, `CCS811`)
**How it works:** Detects if a sensor stops communicating over I2C or returns invalid data (-999).
**How to test:** 
1. While the node is running, carefully unplug the SDA, SCL, or power (3.3V/5V) wire from one of the sensors (like the SCD41 or SPS30). 
2. The dashboard should detect the sensor failure and tell you exactly which sensor disconnected.
