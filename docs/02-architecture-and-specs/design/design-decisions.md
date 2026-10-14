# Design Decisions

## Purpose
The purpose of this document is to formally detail the engineering rationale behind the architectural evolution of the Smart Monitoring platform. It explains why the initial project proposal—which relied on simplistic static thresholding—was deemed inadequate and subsequently evolved into an adaptive, multi-sensor analytical platform capable of complex environmental heuristics.

---

## Design philosophy
The architectural evolution was guided by the following core engineering principles:

* **Reliability:** The system must accurately distinguish between genuine environmental hazards and transient, harmless anomalies.
* **Fault tolerance:** Hardware failures, sensor drift, and network disconnections must be handled gracefully without catastrophic system failure.
* **Explainability:** Alerts must be traceable to explicit mathematical rules rather than relying solely on opaque, "black-box" machine learning models.
* **Scalability:** The architecture must effortlessly support thousands of concurrent sensor nodes by distributing computational workloads.
* **Maintainability:** Distinct operational concerns (e.g., safety limits versus predictive ML) must be cleanly decoupled into independent alert engines.
* **Resource efficiency:** Network bandwidth, database I/O, and UI rendering cycles must be protected from high-frequency telemetry spam.

---

## Decision 1 – Rolling statistics

* **Original approach:** Evaluate raw sensor telemetry against absolute static boundaries every 1 second.
* **Problem:** Raw digital sensors exhibit microscopic electronic jitter. A single human breath or a transient gust of wind caused immediate false-positive alerts, rendering the dashboard unusable.
* **Implementation:** An edge/fog-tier calculated 30-sample sliding window generating a rolling Mean, Standard Deviation, and Maximum value for every environmental vector.
* **Solution:** Replaced raw evaluation with statistical smoothing, establishing a reliable ~2.5-minute environmental baseline.
* **Benefits:** Fundamentally eliminated 1-second transient noise. Enabled the calculation of dynamic standard deviations, which formed the foundation of the heuristic alerting engine.
* **Limitations:** Imposes minor memory and computational overhead at the edge/fog tier, and introduces a slight delay in recognizing slow-moving trends.

---

## Decision 2 – Dynamic heuristics

* **Transient-event detection:** Identifies rapid, short-lived spikes (e.g., a burst of VOCs from hand sanitizer) by ensuring the current value has spiked significantly above the mean, but quickly dispersed back to a recovery floor.
* **Sustained-event detection:** Identifies dangerous long-term buildups (e.g., CO2) by ensuring the rolling mean remains dangerously high while the standard deviation is extremely low, effectively filtering out erratic, short-lived spikes.
* **Adaptive thresholds:** Utilizes standard deviation multipliers (e.g., 2-sigma or 3-sigma rules) to trigger alerts based on relative changes to the environment rather than rigid numbers, allowing the system to adapt to different rooms or climates.
* **Noise-floor clamping:** Integrates physical hardware accuracy limits into the mathematical rules to prevent the adaptive thresholds from collapsing to zero during clean-air scenarios.

---

## Decision 3 – Multi-sensor correlation
A single sensor vector lacks contextual awareness and is therefore insufficient for complex event classification.

* **PM2.5 and TVOC:** Both spike during dusting or the use of cleaning chemicals. 
* **Temperature:** An anomalous heat rise combined with PM2.5 and TVOC confirms a physical fire (`COMBUSTION_WARNING`).
* **Humidity and CO₂:** A sudden spike in humidity is normally caused by human respiration. By verifying that CO2 standard deviation is completely flat, the system isolates pure moisture leaks (e.g., a water spill).

By fusing multiple vectors into single mathematical rules, the platform eliminates false positives (e.g., classifying a perfume spray as a fire, or a rainstorm as a pipe leak).

---

## Decision 4 – Occupancy detection

* **Why 800 ppm was selected:** Empirical models of human respiration indicate that a sealed indoor space will rapidly rise from a global baseline of ~410 ppm and stabilize around 800 ppm when occupied by humans.
* **Why standard deviation was included:** Human respiration produces a steady, continuous volume of gas. By requiring the standard deviation to be under 50 ppm, the system verifies a sustained, stable presence rather than a sudden burst of gas near the sensor.
* **Advantages:** Provides highly accurate, privacy-preserving room occupancy detection without the use of invasive cameras or microphones.
* **Disadvantages:** Operates on a delayed timeline compared to immediate-trigger hardware like PIR motion sensors.

---

## Decision 5 – Hardware fault detection

* **Sentinel values:** Out-of-bounds constants (e.g., `-999.0`) transmitted by the edge nodes gracefully indicate that a sensor reading is mathematically invalid due to hardware failure, triggering a `HARDWARE_FAULT` alert rather than crashing the database.
* **Health bit masks:** An efficient 8-bit mask (e.g., `0x01`, `0x02`) dynamically unpacks the exact physical I2C sensor chip (SCD41, SPS30, CCS811) that failed, providing granular repair instructions.
* **Node timeouts:** A scheduled 30-second sweep compares `lastSeenAt` timestamps against a 120-second timeout interval, reliably detecting mesh network degradation or total edge-node power loss.
* **Self-healing mechanisms:** The backend is engineered to automatically resolve and close `HARDWARE_FAULT` or `NODE_OFFLINE` alerts the moment valid telemetry resumes, preventing latched, obsolete alerts from masking the true operational state of the network.

---

## Decision 6 – Debounce protection

* **Duplicated alerts:** A single transient event could theoretically trigger an `INFO` alert every second during its duration. 
* **Database load:** Unbounded inserts severely degrade MongoDB write performance.
* **UI stability:** A flood of identical WebSocket messages crashes frontend clients.
* **Clustered environments:** In high-density deployments, multiple nodes in the same room might report the exact same event simultaneously.
* **Solution:** A 300-second distributed debounce query suppresses identical state events, yielding a highly stable, performant infrastructure.

---

## Decision 7 – Noise-floor clamping

* **Sensor accuracy limitations:** Physical digital sensors (e.g., SCD41, SPS30) possess inherent accuracy tolerances (e.g., ±30 ppm for CO2, ±5% for Humidity).
* **Microscopic variance:** In a perfectly clean, sealed room, the statistical variance drops to nearly zero.
* **False positives:** With a standard deviation near zero, an utterly meaningless microscopic change (e.g., a 1 ppb VOC shift) mathematically triggers a massive 3-sigma anomaly alert.
* **Hardware tolerances:** By enforcing `Math.max(3 * std_dev, HARDWARE_FLOOR)`, the system successfully forces the statistical heuristic to respect the absolute physical limitations of the silicon chips.

---

## Decision 8 – Separation of concerns

* **Edge tier:** Responsible strictly for raw hardware polling, baseline statistical smoothing, and mesh transmission.
* **Fog tier:** Aggregates telemetry, bridging the MQTT/Thread network to the HTTP backend.
* **Backend tier:** A stateless Java Spring Boot application strictly executing synchronous business rules and multi-engine alerting.
* **Database tier:** MongoDB, providing isolated, persistent document storage.
* **ML service:** A decoupled Python application tasked solely with heavy, asynchronous predictive anomaly detection, preventing CPU-intensive tensor operations from blocking the low-latency Java ingestion pipeline.
* **Frontend tier:** A React dashboard consuming WebSockets for zero-latency UI rendering.

---

## Alternatives considered

* **Purely static thresholds:** The original proposal. Rejected due to catastrophic false-positive rates caused by seasonal weather drift and transient human interactions.
* **Purely ML-based approaches:** Rejected due to a lack of explainability. Life-safety alerts (like fire detection) require deterministic, auditable rules rather than opaque neural-network probability weights. It is also computationally infeasible to run heavy ML on edge microcontrollers.
* **Rule engines:** External rule engines (e.g., Drools) were evaluated but deemed excessively complex for the required heuristics, introducing unnecessary serialization latency.
* **Hybrid architecture (Selected):** A deliberate fusion of deterministic static safety bounds (ASHRAE/WHO), dynamic statistical heuristics (environmental anomalies), and decoupled machine learning (predictive forecasting).

---

## Lessons learned
The transition from a theoretical proposal to a physical deployment exposed the harsh reality of sensor noise in the physical world. Implementing standard deviations alone was insufficient; without noise-floor clamping derived from actual hardware datasheets, high-precision sensors paradoxically generated more false positives than low-precision sensors. Distributing the computational load of rolling statistics to the edge tier proved essential for maintaining backend scalability.

---

## Conclusions
The architectural decisions documented herein directly facilitated the evolution of the Smart Monitoring platform from a simplistic data-logger into an enterprise-grade IoT ecosystem. By embracing a multi-engine alerting paradigm, the system guarantees the strict enforcement of life-safety standards while leveraging sophisticated, multi-sensor correlative heuristics to eliminate false positives and provide profound environmental observability.
