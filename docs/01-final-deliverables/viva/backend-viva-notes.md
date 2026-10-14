# Viva Notes

## System overview

**"What did you build?"**
I built an enterprise-grade IoT environmental monitoring platform. It consists of physical sensor nodes operating on a mesh network that transmit raw telemetry to an edge/fog tier for statistical baseline processing. This data is ingested by a scalable Java Spring Boot backend featuring a multi-engine alert architecture that evaluates both static safety limits and complex, multi-sensor dynamic heuristics. Finally, it persists the data in MongoDB and broadcasts it in real-time via WebSockets to a React frontend, while a decoupled Python ML service provides predictive anomaly detection.

---

## Architecture

**"Why did you choose a layered architecture?"**
A layered architecture enforces a strict separation of concerns. It allows each discrete component to scale independently, fail gracefully, and be developed or tested in isolation without creating a monolithic bottleneck.

**"Why did you separate the edge, fog, backend, database, ML, and frontend layers?"**
Each layer has a fundamentally different operational profile. The edge handles real-time hardware I/O; the fog handles local network aggregation and statistical smoothing; the backend enforces synchronous business logic; the database manages state persistence; ML handles heavy, asynchronous tensor computations; and the frontend handles zero-latency UI rendering. Mixing these would drastically compromise system stability and performance.

**"Why did you not put everything into a single application?"**
Running CPU-intensive machine learning algorithms alongside a high-throughput WebSocket broadcaster and HTTP ingestion pipeline in a single monolithic application would cause severe blocking I/O, resulting in latency spikes and dropped telemetry packets.

---

## Thresholds

**"Why did you choose 1500 ppm?"**
It's verified directly against ASHRAE's official Position Document on Indoor Carbon Dioxide (2025) — not ASHRAE 62.1, which that same document explicitly confirms sets no CO2 concentration limit at all ("misunderstanding of information in previous editions... continue to lead many to incorrectly attribute a 1000 ppmv limit to ASHRAE"). 1500 ppm sits at the upper end of the ~1000–1500 ppm range of international indoor CO2 guideline values that document compiles, from a database maintained by ISIAQ. ASHRAE's own position is that direct-cognitive-effect evidence at these concentrations is inconsistent, so we treat this as a conservative guideline-based threshold rather than a claimed physiological cutoff.

**"Why did you choose 35 µg/m³?"**
Verified directly against the EPA NAAQS table: 35 µg/m³ is the exact 24-hour primary/secondary PM2.5 standard. WHO's actual 2021 guideline is far stricter (15 µg/m³ 24-hour), so we cite EPA specifically rather than a blended "WHO/EPA" — the EPA figure is the number we actually implemented.

**"Why did you choose 1000 ppb?"**
It's a conservative threshold on the sensor's native ppb scale, set above WELL v2's 500 µg/m³ continuous-monitoring concern level for total volatile organic compounds (TVOC). Note the two numbers are on different units (ppb vs. µg/m³) with no single agreed conversion factor, so we don't claim an exact numeric relationship — just that our threshold is conservatively above WELL's concern level.

**"How do you handle Humidity — is it a static threshold or a dynamic heuristic?"**
Both, for different purposes. `humidityMax`/`humidityMin` (60% / 20% RH) is a hard static life-safety bound, verified directly against the OSHA Technical Manual's stated "humidity control in the range of 20%-60%." But a static bound alone can't catch a fast, localized event — a spill, a leak, steam — well before the room average ever reaches 60%. That's what the dynamic `MOISTURE_EVENT` heuristic is for: a rapid +6% RH deviation above the rolling mean (clamped to the SCD4x's own ±6% RH accuracy floor so sensor jitter can't trigger it), confirmed by flat CO2 variance so it isn't fooled by human breath. The static bound and the heuristic are complementary layers, not a replacement for each other.

**"Why did you introduce noise floors?"**
High-precision digital sensors exhibit microscopic variance even in perfectly clean air. Because the standard deviation in a clean room approaches zero, utterly meaningless 1-ppb shifts mathematically triggered massive 3-sigma statistical anomalies. Clamping the math to the physical hardware's specified accuracy limits eliminated these false positives.

---

## Statistics

**"Why did you use rolling statistics?"**
Raw 1-second telemetry contains inherent electronic jitter. Rolling statistics smooth out this noise, providing a mathematically stable and historically contextual environmental baseline (the mean) against which to evaluate anomalies.

**"Why did you use standard deviation?"**
It dynamically measures the current volatility of the room. This allows the system to trigger alerts based on significant *relative* changes to the environment rather than rigid absolute numbers, making the heuristics completely adaptive to any climate, room size, or baseline drift.

**"Why did you choose a 30-sample window?"**
Assuming standard sensor polling intervals, 30 samples represent roughly a 2.5 to 5-minute physical window. This provides a baseline long enough to be mathematically stable, yet short enough to rapidly respond to sudden environmental events, such as a window being opened.

**"Why did you choose two-sigma and three-sigma thresholds?"**
They represent standard statistical anomalies. A 2-sigma event (roughly the 95th percentile) reliably detects moderate environmental shifts like HVAC engagement, while a 3-sigma event (roughly the 99.7th percentile) isolates extreme, sudden anomalies like chemical sprays, dust clouds, or water leaks.

---

## Alert engines

**"Why are there four alert engines instead of one?"**
They serve fundamentally different operational concerns. The Static Engine enforces deterministic life-safety limits; the Heuristic Engine evaluates complex environmental anomalies; the Hardware Engine tracks I2C bitmasks and node timeouts; and the ML Engine handles predictive forecasting. Isolating them prevents brittle, spaghetti-code rules and allows independent tuning.

**"What happens if the ML service fails?"**
Because the architecture is cleanly decoupled, the core Spring Boot backend continues to process static safety alerts, dynamic heuristics, and hardware faults entirely without interruption. Only predictive anomalies are temporarily lost.

**"Why not use only machine learning?"**
Machine learning models are inherently opaque. Life-safety alerts (like fire detection or freezing temperatures) strictly require deterministic, auditable, and immediately explainable rules. Furthermore, running heavy ML models directly on edge microcontrollers is computationally infeasible.

---

## Hardware

**"Why did you use sentinel values?"**
Out-of-bounds constants (like `-999.0`) provide a standard embedded-C mechanism to flag invalid data caused by physical I2C sensor failure. This prevents the backend from accidentally processing dead-sensor data as a legitimate reading of zero.

**"Why did you use bit masks?"**
They allow for the highly memory-efficient packing of individual physical sensor chip states (e.g., SCD41, SPS30, CCS811) into a single 8-bit integer payload, enabling the backend to decode exactly which hardware component failed and issue precise diagnostic repair instructions.

**"How do you detect offline nodes?"**
A centralized background `@Scheduled` job in the backend periodically sweeps the MongoDB database, comparing the `lastSeenAt` timestamp of every registered node against a configurable 120-second timeout threshold.

---

## Scalability

**"What happens if thousands of nodes are added?"**
Because the edge/fog tier handles the memory-intensive rolling statistical calculations, the backend is shielded from heavy CPU load. The backend acts as a stateless service that can be horizontally scaled across multiple containers, leaving only the database write-throughput as the primary bottleneck.

**"What are the bottlenecks?"**
MongoDB write-heavy operations (persisting thousands of raw telemetry documents per second) and the memory overhead required to maintain thousands of concurrent TCP WebSocket sessions on a single backend instance.

**"How would you improve the system?"**
I would introduce an intermediate message broker (like Apache Kafka or RabbitMQ) between the fog tier and the backend to safely buffer ingestion spikes, and migrate the raw telemetry storage from MongoDB to a dedicated Time-Series Database (like InfluxDB or TimescaleDB).

---

## Limitations

**"What would you change if you started again?"**
I would implement Spring Security (using JWT authentication) from day one to secure the REST APIs, and utilize a dedicated Time-Series database for sensor data rather than forcing a standard document store to handle high-frequency time-series workloads.

**"What are the weaknesses of the current architecture?"**
The Spring Boot backend lacks authentication, leaving the API endpoints exposed. Furthermore, all telemetry evaluation currently happens synchronously during the HTTP request thread, which could theoretically block the ingestion pipeline under extreme scale.

---

## Difficult questions

**1. Could your dynamic heuristics be bypassed by a very slow environmental leak?**
Yes. A slow, steady accumulation of a hazard (like a slow gas leak) might drag the rolling mean up gradually without ever breaching a 3-sigma anomaly spike. This is exactly why the Static Threshold engine operates in parallel as an absolute, deterministic fail-safe.

**2. Why push standard deviation calculations to the edge instead of doing them centrally?**
Calculating variance for 1,000 nodes requires maintaining 30,000 historical floats in memory and constantly shifting arrays. Pushing this to the edge microcontrollers achieves massive horizontal scaling at zero computational cost to the central backend server.

**3. Is your debounce mechanism a potential single point of failure?**
If the debounce window is tuned too aggressively, it could theoretically suppress legitimate, rapidly escalating hazards. However, it is explicitly engineered to only suppress identical `INFO` alerts, not critical `WARNING` state changes, mitigating the risk.

**4. If a sensor fails and transmits -999.0, won't that mathematically corrupt the rolling mean?**
No. The embedded firmware and fog logic explicitly ignore sentinel values when updating the sliding mathematical window, ensuring the statistical baseline remains uncorrupted during a sensor reboot or failure.

**5. Why use MongoDB instead of a relational SQL database?**
Sensor payloads are dynamic, unstructured JSON documents that evolve rapidly during prototyping. A schema-less document store like MongoDB accommodates these physical hardware changes without requiring constant, blocking database schema migrations.

**6. How do you handle clock drift between the edge nodes and the backend?**
The edge nodes do not dictate the final temporal state. The backend generates the canonical `createdAt` timestamps upon HTTP ingestion, entirely mitigating issues with edge-side RTC (Real-Time Clock) drift.

**7. Why didn't you use UDP for sensor telemetry transmission?**
UDP is connectionless and does not guarantee packet delivery. Environmental life-safety data requires the guaranteed delivery provided by TCP (via HTTP or MQTT) to ensure critical hazard alerts are never silently dropped over a noisy network.

**8. How did you validate your multi-sensor combustion logic without actually starting a fire?**
Validation was conducted through empirical proxy testing—such as controlled exposure to matchsticks or soldering fumes—to verify the simultaneous triggering of PM2.5, TVOC, and heat variance heuristics.

**9. If the mesh network partitions, will the backend declare all disconnected nodes as offline?**
Yes. The backend relies on a centralized 120-second timeout. A severed mesh topology prevents upstream data delivery, correctly resulting in a `NODE_OFFLINE` alert for all unreachable segments.

**10. Why did you use HTTP REST for ingestion instead of direct MQTT to the backend?**
Using a Fog gateway to bridge MQTT to HTTP REST provides a clean enterprise network boundary, allowing standard IT load balancers and API gateways to route traffic efficiently to stateless backend containers.

**11. What prevents a malicious user from flooding the API with fake telemetry?**
Currently, nothing. The absence of Spring Security and API keys is a documented architectural weakness that must be addressed before any production deployment.

**12. Why use a fixed 30-sample window instead of a strict time-based window (e.g., exactly 3 minutes)?**
Embedded C arrays are vastly simpler and highly memory-efficient to manage as fixed-length circular buffers (samples) rather than attempting to dynamically track asynchronous timestamps within memory-constrained microcontrollers.

**13. If a node comes back online, does it flush its offline data cache?**
If the edge/fog tier implements a store-and-forward buffer, it will flush upon reconnection. The backend will process these chronologically, resolving the `NODE_OFFLINE` state dynamically.

**14. How do you mathematically distinguish between hardware sensor drift and a legitimate slow environmental change?**
We cannot easily distinguish them with software alone. However, physical sensor drift typically occurs over months or years, whereas environmental changes (even incredibly slow ones) occur over hours.

**15. Does the WebSocket implementation scale horizontally to thousands of users?**
Not horizontally without an external message broker. A single backend instance is bottlenecked by TCP port limits and memory. Horizontal scaling requires a broker like Redis Pub/Sub to synchronize WebSocket states across multiple backend containers.

**16. Why isn't alert evaluation asynchronous in your Spring Boot application?**
It was designed for architectural simplicity and immediate consistency. Under massive enterprise scale, migrating alert evaluation to an `@Async` thread pool or a Kafka message queue would be necessary to prevent HTTP thread starvation.

**17. Are standard deviation multipliers mathematically sound for non-normally distributed environmental data?**
Environmental data is rarely perfectly Gaussian. However, Chebyshev's inequality guarantees that a 3-sigma bound still strictly captures the vast majority of variance, making it a highly robust empirical heuristic regardless of the underlying mathematical distribution.

**18. If the predictive ML anomaly detector contradicts the deterministic static rules, which wins?**
The static rules unconditionally win. Deterministic life-safety constraints (e.g., >35°C) are absolute. The ML engine provides valuable early warnings and trend analysis, but it is never permitted to override physical safety limits.

**19. How did you determine the exact noise floor values for statistical clamping?**
They were derived via direct extraction from the physical hardware datasheets (e.g., ±(50 ppm + 3% of reading) CO2 accuracy and ±0.8°C temperature accuracy for the SCD41, both confirmed directly from the Sensirion SCD4x datasheet). The one exception is the CCS811's TVOC floor (±25 ppb) — its datasheet publishes no TVOC accuracy specification at all, so that value is a project-selected conservative margin rather than a datasheet-derived one, combined with observed steady-state variance testing in a sealed, clean room.

**20. Is the system truly self-healing?**
Soft-state failures are fully self-healing (e.g., automatically clearing `NODE_OFFLINE` when network telemetry resumes). However, catastrophic hardware faults on the I2C bus often require physical human intervention (e.g., replacing the sensor chip) and cannot heal via software alone.
