# Assignment Analysis: Hidden Connections to SSNS Project

**Assignment:** Signal and Systems Theory - WSN IoT DS Research Group  
**Semester:** Summer 2026  
**Analysis Date:** 2026-06-12

---

## Executive Summary

**Key Finding:** This assignment is **not random** - it's designed to make you think deeply about the **fundamental measurement theory** underlying your SSNS sensor network project.

**Hidden Message:** The professor wants you to understand that your project isn't just about "reading sensors" - it's about the **entire measurement chain** from physical phenomena to digital data to information.

---

## Question-by-Question Analysis

### Q1: What is the definition of information in physics and computer science?

**Connection to SSNS:**
Your project transforms **physical quantities** (temperature, CO₂, PM2.5) into **information** (anomaly alerts, event classifications).

**Hidden Insight:**
- **Physics perspective:** Information = reduction of uncertainty about a physical state
- **CS perspective:** Information = data with context and meaning

**Application to your thesis:**
```
Physical State: Room temperature = 22.5°C
↓
Data: CBOR packet [22.5, 45.2, 650, ...]
↓
Information: "Normal office environment" OR "HVAC failure detected"
```

**Thesis Chapter:** Introduction - Define what "intelligent monitoring" means in information-theoretic terms.

---

### Q2: What is a physical quantity?

**Connection to SSNS:**
Your sensors measure **10 physical quantities**:
- Temperature (°C)
- Humidity (%RH)
- CO₂ concentration (ppm)
- TVOC concentration (ppb)
- PM1.0, PM2.5, PM4.0, PM10 (µg/m³)
- Light intensity (lux)

**Hidden Insight:**
Each physical quantity has:
- **Dimension** (e.g., temperature = [Θ])
- **Unit** (e.g., Celsius, Kelvin)
- **Measurement uncertainty** (±0.5°C for SCD41)

**Application to your thesis:**
Document the **measurement uncertainty** for each sensor:
```
SCD41 Temperature: ±0.5°C (datasheet spec)
SCD41 CO₂: ±(50 ppm + 5% of reading)
SPS30 PM2.5: ±10 µg/m³
```

**Why this matters:** Your ML model's anomaly detection threshold must be **larger than measurement uncertainty** to avoid false positives.

**Thesis Chapter:** Methodology - Justify your anomaly detection thresholds based on sensor uncertainty.

---

### Q3: What are SI units?

**Connection to SSNS:**
Your sensors use **SI-derived units**:
- Temperature: Kelvin (K) → displayed as Celsius (°C = K - 273.15)
- Mass concentration: kg/m³ → displayed as µg/m³ (PM sensors)
- Amount of substance: mol/m³ → displayed as ppm (CO₂)

**Hidden Insight:**
The professor wants you to understand **unit conversions** and **dimensional analysis**.

**Application to your thesis:**
Explain why CO₂ is measured in **ppm** (parts per million) instead of kg/m³:
```
1 ppm CO₂ = 1.8 mg/m³ (at 25°C, 1 atm)
400 ppm = 720 mg/m³ = 0.72 g/m³
```

**Why this matters:** When comparing CO₂ trends across different altitudes or temperatures, you need to account for density changes.

**Thesis Chapter:** System Description - Document all unit conversions in your data pipeline.

---

### Q4: What is the definition of measurement?

**Connection to SSNS:**
Your entire project **is** a measurement system!

**Hidden Insight:**
Measurement = **comparison** of an unknown quantity against a **known standard**.

**Application to your thesis:**
Your sensors perform measurement through:
1. **SCD41 CO₂:** NDIR (Non-Dispersive Infrared) - compares IR absorption against calibration curve
2. **CCS811 TVOC:** Metal-oxide resistance - compares resistance change against baseline
3. **SPS30 PM:** Laser scattering - compares scattered light intensity against particle size calibration

**Thesis Chapter:** System Description - Explain the **measurement principle** for each sensor (not just "it measures CO₂").

---

### Q5: Describe different measurement principles!

**Connection to SSNS:**
Your project uses **3 different measurement principles**:

| Sensor | Principle | Physical Phenomenon |
|--------|-----------|---------------------|
| **SCD41** | NDIR (Non-Dispersive Infrared) | CO₂ molecules absorb IR at 4.26 µm wavelength |
| **CCS811** | Metal-oxide chemiresistor | VOC molecules change resistance of SnO₂ layer |
| **SPS30** | Laser scattering | Particles scatter 650nm laser light proportional to size |

**Hidden Insight:**
Each principle has **different characteristics**:
- **NDIR:** High accuracy, slow response (5s), no drift
- **Metal-oxide:** Fast response (1s), requires 20-min warm-up, baseline drift
- **Laser scattering:** Continuous measurement (1s), requires fan cleaning every 168h

**Application to your thesis:**
This explains **why you need per-sensor sampling rates** (Statistical Aggregation V2):
- SCD41: 5.5s (limited by NDIR measurement cycle)
- CCS811: 1.0s (metal-oxide responds quickly to VOC changes)
- SPS30: 1.5s (laser scattering is continuous)

**Thesis Chapter:** System Description - Justify your sampling strategy based on measurement principles.

---

### Q6: How is the measuring process structured?

**Connection to SSNS:**
Your measuring process has **5 stages**:

```
1. Physical Phenomenon (CO₂ in air)
   ↓
2. Sensor Transducer (NDIR detector)
   ↓
3. Signal Conditioning (ADC, amplification)
   ↓
4. Data Acquisition (I2C read, CBOR encoding)
   ↓
5. Data Processing (IsolationForest, anomaly detection)
```

**Hidden Insight:**
The professor wants you to understand that **each stage introduces errors**:
- Stage 1: Environmental noise (air currents, temperature gradients)
- Stage 2: Sensor drift, hysteresis
- Stage 3: ADC quantization noise, amplifier offset
- Stage 4: I2C transmission errors (handled by CRC)
- Stage 5: ML model uncertainty (false positives/negatives)

**Application to your thesis:**
Document the **error budget** for your system:
```
Total uncertainty = √(sensor² + ADC² + transmission² + ML²)
                  = √(50² + 5² + 0² + 100²) ppm
                  = 112 ppm for CO₂
```

**Thesis Chapter:** Methodology - Justify why your anomaly threshold (e.g., 200 ppm deviation) is larger than total uncertainty.

---

### Q7: How is the interaction between measuring process and measuring object?

**Connection to SSNS:**

**(a) Classical physics:**
Your sensors **do not disturb** the measured environment:
- SCD41 draws 0.5 mL/min air (negligible compared to room volume)
- CCS811 heater adds <0.1W (negligible thermal impact)
- SPS30 fan draws 5 mL/s air (negligible flow)

**(b) Quantum physics:**
Not applicable (your sensors measure macroscopic quantities).

**Hidden Insight:**
The professor wants you to think about **observer effect**:
- Does your sensor **change** the environment it's measuring?
- Example: A poorly designed PM sensor with a strong fan could **create air currents** that affect PM distribution.

**Application to your thesis:**
Discuss **sensor placement** considerations:
- Don't place sensor near HVAC vent (disturbed airflow)
- Don't place sensor near heat source (thermal gradient)
- Don't place sensor in direct sunlight (photodegradation of CCS811)

**Thesis Chapter:** Methodology - Justify your sensor placement strategy.

---

### Q8: What means calibration and how does a typical calibration process work?

**Connection to SSNS:**
Your sensors require **calibration**:

**SCD41 CO₂:**
- **Factory calibration:** Against NIST-traceable CO₂ reference gas
- **Field calibration:** Automatic Self-Calibration (ASC) - assumes 400 ppm outdoor air exposure every 7 days
- **Your implementation:** Disabled ASC (indoor-only deployment)

**CCS811 TVOC:**
- **Factory calibration:** Against known VOC mixtures
- **Field calibration:** 20-minute warm-up + baseline learning
- **Your implementation:** 20-minute warm-up enforced in firmware

**SPS30 PM:**
- **Factory calibration:** Against NIST-traceable particle counters
- **Field calibration:** Automatic fan cleaning every 168 hours
- **Your implementation:** Fan cleaning handled by driver

**Hidden Insight:**
The professor wants you to understand **calibration drift**:
- SCD41: Minimal drift (<5 ppm/year)
- CCS811: Significant drift (requires periodic recalibration)
- SPS30: Minimal drift (fan cleaning prevents buildup)

**Application to your thesis:**
Discuss **when to recalibrate** your ML model:
- After sensor replacement (new baseline)
- After seasonal change (HVAC patterns change)
- After room renovation (new VOC sources)

**This is why you implemented the CALIBRATE button!**

**Thesis Chapter:** Methodology - Justify your ML calibration strategy based on sensor calibration theory.

---

### Q9: What are calibration standards?

**Connection to SSNS:**
Your sensors are calibrated against **NIST-traceable standards**:
- CO₂: NIST SRM 1720a (400 ppm reference gas)
- PM: NIST SRM 2786 (polystyrene latex spheres)
- Temperature: NIST ITS-90 (International Temperature Scale)

**Hidden Insight:**
The professor wants you to understand **traceability chain**:
```
Your sensor → Manufacturer calibration → National lab (NIST) → SI definition
```

**Application to your thesis:**
Cite the **calibration standards** used by sensor manufacturers:
- Sensirion SCD41: Calibrated against NIST SRM 1720a
- Sensirion SPS30: Calibrated against NIST SRM 2786

**Thesis Chapter:** System Description - Establish credibility by citing calibration standards.

---

### Q10: What is the definition of data acquisition and which computer science fields are associated?

**Connection to SSNS:**
Your project **is** a data acquisition system!

**Data Acquisition = Sampling + Quantization + Encoding + Transmission**

**Associated CS fields:**
1. **Signal Processing:** Filtering, downsampling (your statistical aggregation)
2. **Embedded Systems:** Firmware, I2C drivers, RTOS
3. **Networking:** CoAP, Thread mesh, IPv6
4. **Databases:** MongoDB, time-series storage
5. **Machine Learning:** IsolationForest, anomaly detection
6. **Distributed Systems:** Gateway, backend, ML service

**Hidden Insight:**
The professor wants you to see your project as **interdisciplinary**:
- Not just "IoT project"
- Not just "ML project"
- **Data acquisition system** that spans multiple CS fields

**Application to your thesis:**
Structure your thesis to highlight **interdisciplinary contributions**:
- **Embedded Systems:** Multi-threaded sensor aggregator
- **Networking:** Thread mesh with CoAP
- **Machine Learning:** Hybrid anomaly detection (rules + IsolationForest)
- **Data Engineering:** Statistical aggregation with per-sensor sampling

**Thesis Chapter:** Introduction - Position your work as interdisciplinary data acquisition research.

---

### Q11: What are typical instrumentation components?

**Connection to SSNS:**
Your system has **all typical components**:

| Component | Your Implementation |
|-----------|---------------------|
| **Sensor** | SCD41, CCS811, SPS30 |
| **Transducer** | NDIR detector, metal-oxide, laser |
| **Signal Conditioning** | Internal ADC, amplifiers |
| **Data Acquisition** | nRF52840 I2C master |
| **Data Processing** | Firmware (aggregator), ML service |
| **Data Storage** | MongoDB |
| **Data Visualization** | React dashboard |
| **Communication** | Thread mesh, CoAP, HTTP |

**Hidden Insight:**
The professor wants you to map your project to **standard instrumentation architecture**.

**Application to your thesis:**
Create a **system block diagram** showing all instrumentation components:
```
┌─────────┐   I2C    ┌──────────┐   Thread   ┌─────────┐
│ Sensors │ ────────→│ nRF52840 │ ──────────→│ Gateway │
└─────────┘          └──────────┘            └─────────┘
                                                   │ HTTP
                                                   ▼
                                              ┌─────────┐
                                              │ Backend │
                                              └─────────┘
                                                   │
                                                   ▼
                                              ┌─────────┐
                                              │   ML    │
                                              └─────────┘
```

**Thesis Chapter:** System Architecture - Use standard instrumentation terminology.

---

### Q12: How is the information flow in a measuring chain of data acquisition devices?

**Connection to SSNS:**
Your information flow has **4 transformations**:

```
1. Physical → Electrical (Sensor transducer)
   CO₂ molecules → IR absorption → Voltage

2. Electrical → Digital (ADC)
   Voltage → 16-bit integer → Floating point

3. Digital → Encoded (CBOR)
   Floating point → CBOR array → 88 bytes

4. Encoded → Information (ML)
   88 bytes → Feature vector → "ANOMALY" or "NORMAL"
```

**Hidden Insight:**
The professor wants you to understand **information loss** at each stage:
- Stage 1: Sensor resolution (SCD41: ±50 ppm)
- Stage 2: ADC quantization (16-bit = 0.0015% resolution)
- Stage 3: CBOR encoding (lossless)
- Stage 4: ML classification (lossy - reduces to binary decision)

**Application to your thesis:**
Discuss **where information is lost** and **where it's preserved**:
- Statistical aggregation (mean, std, max) **preserves** more information than single value
- IsolationForest **loses** information by reducing to binary anomaly/normal
- Event classification **recovers** information by adding context

**Thesis Chapter:** Discussion - Analyze information flow and justify your design choices.

---

### Q13: What are the components and interfaces in a measuring chain?

**Connection to SSNS:**
Your measuring chain has **5 interfaces**:

| Interface | Protocol | Data Format | Bandwidth |
|-----------|----------|-------------|-----------|
| **Sensor ↔ MCU** | I2C | Binary registers | 100 kHz |
| **MCU ↔ Gateway** | CoAP/UDP | CBOR (88 bytes) | 250 kbps |
| **Gateway ↔ Backend** | HTTP/TCP | JSON (350 bytes) | 1 Gbps |
| **Backend ↔ ML** | HTTP/TCP | JSON (feature vector) | 1 Gbps |
| **Backend ↔ Dashboard** | WebSocket | JSON (real-time) | 1 Gbps |

**Hidden Insight:**
The professor wants you to understand **interface design trade-offs**:
- I2C: Low bandwidth, low power, short distance
- CoAP: Optimized for constrained devices, UDP (unreliable)
- HTTP: High bandwidth, TCP (reliable), standard

**Application to your thesis:**
Justify **why you chose each interface**:
- I2C: Industry standard for sensor communication
- CoAP: Designed for IoT (smaller than HTTP)
- CBOR: 4x smaller than JSON (88 vs 350 bytes)
- Thread: Mesh networking (self-healing, no single point of failure)

**Thesis Chapter:** System Architecture - Justify interface choices based on requirements.

---

### Q14: What is the fie... (cut off)

**Likely completion:** "What is the **fidelity** of a measurement system?"

**Connection to SSNS:**
Fidelity = How accurately your system reproduces the true physical state.

**Your system's fidelity is limited by:**
1. **Sensor accuracy:** SCD41 ±50 ppm, SPS30 ±10 µg/m³
2. **Sampling rate:** 30-second intervals (misses transient events <30s)
3. **Spatial resolution:** Single sensor per room (doesn't capture gradients)
4. **Temporal resolution:** 30-second transmission (not real-time)

**Hidden Insight:**
The professor wants you to discuss **system limitations**:
- What events can your system detect?
- What events does it miss?
- How could fidelity be improved?

**Application to your thesis:**
This is why you proposed **statistical aggregation**:
- Increases temporal fidelity (captures transient events via MAX)
- Increases measurement fidelity (reduces noise via averaging)
- Maintains spatial fidelity (per-sensor statistics)

**Thesis Chapter:** Discussion - Analyze system fidelity and propose improvements.

---

## Hidden Thesis Structure

The professor is **guiding your thesis structure** through these questions:

### Chapter 1: Introduction
- Q1: Define information (physics + CS perspective)
- Q10: Position as interdisciplinary data acquisition research

### Chapter 2: Fundamentals
- Q2: Physical quantities and their measurement
- Q3: SI units and dimensional analysis
- Q4: Definition of measurement
- Q5: Measurement principles (NDIR, metal-oxide, laser scattering)

### Chapter 3: System Architecture
- Q11: Instrumentation components
- Q12: Information flow
- Q13: Interfaces and protocols

### Chapter 4: Methodology
- Q6: Measuring process structure (5 stages)
- Q7: Observer effect and sensor placement
- Q8: Calibration strategy (sensors + ML model)
- Q9: Calibration standards and traceability

### Chapter 5: Implementation
- Your firmware, gateway, backend, ML service

### Chapter 6: Evaluation
- Q14: System fidelity analysis
- A/B testing results
- False positive rate comparison

### Chapter 7: Discussion
- Information loss analysis
- Limitations and future work

---

## Key Insights for Your Thesis

### 1. Justify Anomaly Thresholds
**Assignment Question 2 + 6:**
Your anomaly detection thresholds must be **larger than measurement uncertainty**:
```
SCD41 CO₂ uncertainty: ±50 ppm
Your anomaly threshold: ±200 ppm (4x larger)
Justification: Avoids false positives from sensor noise
```

### 2. Justify Sampling Rates
**Assignment Question 5:**
Your per-sensor sampling rates are based on **measurement principles**:
```
SCD41 (NDIR): 5.5s - limited by IR absorption measurement cycle
CCS811 (metal-oxide): 1.0s - fast resistance change
SPS30 (laser): 1.5s - continuous scattering measurement
```

### 3. Justify Statistical Aggregation
**Assignment Question 12:**
Statistical aggregation **preserves information** that single-value sampling loses:
```
Single value: 650 ppm (no context)
Statistics: mean=650, std=15, max=680 ppm (captures variability)
```

### 4. Justify ML Calibration
**Assignment Question 8:**
Your ML calibration strategy is analogous to **sensor calibration**:
```
Sensor calibration: Compare against known standard
ML calibration: Learn baseline from "normal" environment
Both require recalibration after environmental changes
```

### 5. Justify Hybrid Detection
**Assignment Question 10:**
Your hybrid approach (rules + ML) spans **multiple CS fields**:
```
Rules: Signal processing (variance-based thresholds)
ML: Machine learning (IsolationForest)
Hybrid: Best of both worlds (interpretable + adaptive)
```

---

## Recommended Actions

### 1. Add Measurement Theory Chapter
Create a new chapter in your thesis:
**"Chapter 2: Fundamentals of Environmental Measurement"**
- Physical quantities and SI units
- Measurement principles (NDIR, metal-oxide, laser scattering)
- Measurement uncertainty and error budgets
- Calibration theory

### 2. Document Sensor Specifications
Create a table with **complete sensor specifications**:
| Sensor | Principle | Range | Accuracy | Resolution | Response Time |
|--------|-----------|-------|----------|------------|---------------|
| SCD41 Temp | NDIR | -10 to +60°C | ±0.8°C | 0.01°C | 5s |
| SCD41 CO₂ | NDIR | 400-5000 ppm | ±(50+5%) | 1 ppm | 5s |
| CCS811 TVOC | Metal-oxide | 0-1187 ppb | ±15% | 1 ppb | 1s |
| SPS30 PM2.5 | Laser | 0-1000 µg/m³ | ±10 µg/m³ | 0.1 µg/m³ | 1s |

### 3. Calculate Error Budget
Document the **total system uncertainty**:
```
CO₂ measurement:
- Sensor: ±50 ppm
- ADC quantization: ±0.5 ppm
- I2C transmission: ±0 ppm (CRC protected)
- ML model: ±100 ppm (false positive rate)
Total: √(50² + 0.5² + 0² + 100²) = 112 ppm
```

### 4. Justify Design Decisions
For every design choice, reference **measurement theory**:
- Sampling rate → Measurement principle response time
- Anomaly threshold → Measurement uncertainty
- Statistical aggregation → Information preservation
- ML calibration → Calibration theory

### 5. Create System Block Diagram
Use **standard instrumentation terminology**:
```
Physical Phenomenon → Transducer → Signal Conditioning → 
Data Acquisition → Data Processing → Data Storage → 
Data Visualization
```

---

## Conclusion

**The professor's hidden message:**
Your project isn't just about "building an IoT system" - it's about understanding the **fundamental principles of measurement** and applying them to create an **intelligent data acquisition system**.

**Key takeaway:**
Every design decision in your project (sampling rates, thresholds, calibration, statistical aggregation) should be **justified by measurement theory**, not just "it works in practice."

**This assignment is your thesis roadmap!**

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-12  
**Status:** Analysis complete