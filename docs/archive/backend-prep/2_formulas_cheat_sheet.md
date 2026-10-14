# 🚀 Backend Alert Formulas — Ultra-Clean Cheat Sheet

## 1. Engine 1 — Immediate Life-Safety Thresholds (Every 5 Seconds)

**1. Carbon Dioxide (CO2 Stuffiness — ASHRAE 62.1):**
```sql
Current CO2 > 1500 ppm AND Rolling Average > 1200 ppm AND CO2 Variance < 150 ppm
```

**2. Temperature High (HVAC Heat Alarm — ASHRAE 55):**
```sql
Current Temperature > 35.0 C
```

**3. Temperature Low (Cold & Pipe Freeze — ASHRAE 55):**
```sql
Current Temperature < 10.0 C
```

**4. PM2.5 Particulate (Active Fire / Smoke — WHO / EPA):**
```sql
Current PM2.5 > 35 ug/m3 AND Current TVOC > 1000 ppb AND Temperature > Rolling Average + (2 * Temperature Variance)
```

**5. Total VOCs (Persistent Chemical Spill — WELL v2):**
```sql
Current TVOC > 1000 ppb AND Rolling Average > 800 ppb AND TVOC Variance < 100 ppb
```

---

## 2. Engine 2 — Statistical Anomaly Formula & Origin Matrix

**General Statistical Z-Score Formula:**
```sql
Peak Reading > Rolling Average + MAX ( Z * Standard Deviation , Hardware Noise Floor )
```

**Where Every Number Comes From (Viva Defense at a Glance):**
| Multiplier / Floor | Value Used | Source & Origin | Why We Use It |
| :--- | :--- | :--- | :--- |
| **Z-Multipliers (3, 2, 1.5)** | `3x, 2x, 1.5x` | **Statistical Bell Curve Law** | `3x` (99.7%) for dust/tea, `2x` (95.4%) for breath/windows, `1.5x` for slow TVOC gas kinetics. |
| **Hardware Noise Floors** | `100 ppm / 5 ug / 25 ppb / 0.2 C` | **Manufacturer Datasheets** | Directly from `Sensirion (SCD41/SPS30)` & `ScioSense (CCS811)` accuracy specs to stop quiet-room false alarms. |

---

## 3. Engine 2 — Multi-Sensor Correlation Rules (3-Minute Window)

**Rule 1 — Human Breath (Transient CO2 Spike):**
```sql
CO2 Peak > Rolling Average + MAX(2 * CO2 Standard Deviation, 100 ppm) AND Current CO2 recovers toward Average within 3 minutes
```

**Rule 2 — Window Opened (Simultaneous Draft & Gas Dilution):**
```sql
Temperature < Rolling Average - (2 * Temperature Standard Deviation) AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)
```

**Rule 3 — Freezing Winter Window (Critical Sub-Zero Draft):**
```sql
Current Temperature < 10 C AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)
```

**Rule 4 — Hot Tea vs Human Breath (Moisture Without Exhalation):**
```sql
Humidity Peak > Rolling Average + MAX(3 * Humidity Standard Deviation, 5 %RH) AND CO2 Standard Deviation < 10 ppm
```

**Rule 5 — Dust Sweeping vs Fire (Physical Soot Without Heat/Gas):**
```sql
PM2.5 Peak > Rolling Average + MAX(3 * PM2.5 Standard Deviation, 5 ug/m3) AND TVOC Variance < 50 ppb AND Temperature Variance < 0.5 C
```

**Rule 6 — Camera-Free Occupancy (Elevated Stable CO2 Baseline):**
```sql
CO2 Rolling Average > 800 ppm AND CO2 Standard Deviation < 50 ppm
```

**Rule 7 — Lighter Flick / Deodorant Spray (Transient Chemical Burst):**
```sql
TVOC Peak > Rolling Average + MAX(1.5 * TVOC Standard Deviation, 25 ppb) AND PM2.5 < 35 ug/m3
```

**Rule 8 — Critical Combustion (Active Fire: Soot + Gas + Heat):**
```sql
Current PM2.5 > 35 ug/m3 AND Current TVOC > 1000 ppb AND Temperature > Rolling Average + (2 * Temperature Standard Deviation)
```

---

## 4. Database Debounce Suppression (MongoDB Window)

**5-Minute Deduplication Window:**
```sql
Current Timestamp - Last Alert Timestamp < 300 seconds
```
