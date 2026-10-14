# SSNS Documentation Master Index

**Smart Sensor Network System (SSNS)** — Complete documentation suite for the Thread-based intelligent indoor environmental monitoring platform.

This directory is organized into a clean, modular hierarchy designed for clarity, academic review, and engineering onboarding.

---

## 🗺️ Documentation Directory Layout

```text
docs/
├── README.md                      ← Master Navigation Guide (This file)
│
├── 01-final-deliverables/         ← Academic deliverables & examination papers
│   ├── report/                    ← IEEE Report (PDF, TeX, Markdown)
│   ├── ai-interaction/            ← AI Usage Methodology Appendix (PDF, TeX)
│   ├── presentation/              ← Presentation Decks & Defense Script
│   └── viva/                      ← Defense & Oral Examination Prep Notes
│
├── 02-architecture-and-specs/     ← Detailed system engineering & protocol specs
│   ├── SYSTEM_REFERENCE.md        ← Authoritative 68KB system reference manual
│   ├── ENVIRONMENTAL_EVENTS.md    ← Safety standards (ASHRAE, OSHA, EPA, WELL)
│   ├── ssns-architecture.html     ← Interactive SVG system architecture diagram
│   ├── tiers/                     ← Subsystem deep-dives (Edge, Fog, Core, UI)
│   └── design/                    ← UI/UX wireframes & SCADA design specs
│
├── 03-hardware/                   ← Physical circuit designs & wiring schematics
│   ├── wiring.md                  ← Sensor I2C pinout diagrams (SCD41, SPS30, CCS811)
│   ├── wiring_external_power.md   ← External breadboard power module distribution
│   ├── HARDWARE_TRANSITION_MASTER_PLAN.md ← Physical transition roadmap
│   └── PHYSICAL_SENSOR_INTEGRATION.md     ← Sensor bus timings & mutex logic
│
├── assets/                        ← High-resolution architectural diagram assets
│
└── archive/                       ← Historical development artifacts & early drafts
    ├── proposals/                 ← Initial semester project proposals
    ├── legacy-latex/              ← Early BLE-based LaTeX drafts
    ├── backend-prep/              ← Early Spring Boot integration notes
    ├── defense-prep/              ← Draft defense talking points
    ├── final-submission-package/  ← Original snapshot of submission bundle
    ├── legacy-md/                 ← Historical markdown meeting notes
    ├── ml-service-enhancement/    ← Preliminary ML evaluation logs
    ├── presentations-drafts/      ← Interim presentation slides
    └── team-guides/               ← Git workflows & environment setup guides
```

---

## 🎯 Quick Navigation: What Should I Read?

### 1. Academic Deliverables & Research Papers
* **[IEEE Conference Report (PDF)](01-final-deliverables/report/ieee-report.pdf):** The formal 9-page IEEE conference publication covering theoretical performance, mathematical formulation, hardware constraints, multi-engine alerting, and the historical topology scrubber.
* **[IEEE LaTeX Source Code](01-final-deliverables/report/ieee-report.tex):** Full reproducible publication source.
* **[AI Usage Appendix (PDF)](01-final-deliverables/ai-interaction/ai-usage-appendix.pdf):** Methodological documentation detailing AI-assisted debugging, verification, and code auditing.
* **[Viva & Defense Q&A Prep](01-final-deliverables/viva/):** Comprehensive oral examination questions and answers on distributed systems, OpenThread mesh self-healing, and isolation forest mathematics.

### 2. Engineering Architecture & Protocol Specifications
* **[System Reference Manual](02-architecture-and-specs/SYSTEM_REFERENCE.md):** Complete technical blueprint covering the Zephyr firmware producer-consumer threads, CoAP/CBOR packet structure, Redis store-and-forward queueing, Spring Boot multi-engine alerts, and React Flow visual mapping.
* **[Environmental Guidelines & Event Standards](02-architecture-and-specs/ENVIRONMENTAL_EVENTS.md):** Deep breakdown of safety bounds derived from OSHA, ASHRAE 55/62.1, U.S. EPA NAAQS, WHO, and WELL v2.
* **[Subsystem Tier Specifications](02-architecture-and-specs/tiers/):**
  * `edge-node.md`: nRF52840 Zephyr firmware, mutex-protected I2C threads, and 50-packet RAM buffer.
  * `fog-node.md`: Linux and macOS autonomous gateways, OTBR, and Redis `SETNX` deduplication.
  * `platform-tier.md`: Horizontally scalable Spring Boot microservices and MongoDB schema.
  * `frontend-tier.md`: Reactive Vite/React SCADA operations center, React Flow, and Historical Scrubber.

### 3. Physical Hardware & Electronics
* **[Sensor Wiring Schematic](03-hardware/wiring.md):** Complete pin-to-pin wiring guide connecting Sensirion SCD41 ($\text{CO}_2$), Sensirion SPS30 (PM), and ScioSense CCS811 (TVOC) to the Nordic nRF52840-DK.
* **[External Power & Jumper Configuration](03-hardware/wiring_external_power.md):** Breadboard power supply module configuration, 3.3V / 5.0V bus isolation, and common ground wiring.
* **[Physical Sensor Integration Blueprint](03-hardware/PHYSICAL_SENSOR_INTEGRATION.md):** Hardware-native sampling frequencies, startup warm-up delays, and I2C mutex arbitration.

### 4. Historical Archive
* **[Historical Development Archive](archive/):** Curated repository of early sprint notes, initial proposals, and interim design reviews, preserved for complete development traceability.

---

## 👨‍💻 Author & Contact

**Muhammad Saleem**  
*M.Sc. High Integrity Systems, Frankfurt University of Applied Sciences*  
Contact: [muhammad.saleem2@stud.fra-uas.de](mailto:muhammad.saleem2@stud.fra-uas.de)  
Project Repository: [muhammadsaleem-dev/ssns-openthread-iot](https://github.com/muhammadsaleem-dev/ssns-openthread-iot)