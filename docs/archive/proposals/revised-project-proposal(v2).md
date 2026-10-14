# Thread-Based Intelligent Indoor Environmental Monitoring System
## Smart Sensor Network System — Revised Project Proposal (V2)

**Team Members:**
Haris Tauseef Khan, Mobeen Anwar,
Muhammad Faris Mufti, Muhammad Inayat Hussain,
Muhammad Saleem, Sohail Asghar Minhas

**Programme:** M.Sc. High Integrity Systems
**Date:** Summer Semester 2026

---

## 1. Abstract
This proposal presents a scalable IoT platform for intelligent indoor environmental monitoring. The proposed system integrates OpenThread (IPv6) sensor nodes based on the Nordic nRF52840 microcontroller with a containerized Gateway-Tier Fog backend. By applying unsupervised machine learning—specifically Isolation Forest-based anomaly detection and sliding window linear regression—across a multi-dimensional telemetry stream, the platform moves beyond conventional single-parameter threshold alerting. Furthermore, a lightweight Explainable AI (XAI) layer is integrated to interpret complex, multi-variable environmental anomalies. This architecture aims to provide operators with transparent, context-aware insights while maintaining implementation feasibility on edge devices, ultimately delivering a reproducible and intelligent telemetry analytics system.

## 2. Introduction
Indoor air quality directly affects human health, comfort, and occupational safety. Elevated concentrations of particulate matter, carbon dioxide, and volatile organic compounds (VOCs) are associated with adverse respiratory and cognitive effects in indoor environments [[6](#ref-6)]. Despite well-established risks, many built environments still rely on periodic manual inspection or rigid threshold-based monitoring systems. Such approaches often lack adaptive multi-variable analysis and may struggle to generalize across dynamic IoT and industrial monitoring environments [[1](#ref-1), [2](#ref-2)]. 

This project proposes a scalable IoT platform designed to support multi-node environmental monitoring utilizing low-power Thread sensor nodes. The system processes telemetry using both deterministic safety rules and unsupervised machine learning. It is designed to identify subtle multi-variable environmental anomalies and provide early warning indicators for hazardous trends before they breach critical safety thresholds.

## 3. Literature Review & Research Gap
Recent advancements in IoT environmental monitoring have explored machine-learning approaches for anomaly detection in resource-constrained and Industrial IoT environments. Ortega et al. [[1](#ref-1)] presented a lightweight Isolation Forest–based anomaly detection approach for edge devices, while Wu et al. [[2](#ref-2)] discussed GNN-based anomaly detection methods for Industrial Internet of Things (IIoT) systems. However, many existing frameworks rely heavily on cloud infrastructure, introducing latency and privacy concerns, or suffer from the "Cold Start Problem" when deployed in new environments [[4](#ref-4)]. Furthermore, while dynamic sliding window techniques have been explored for predictive accuracy in industrial systems [[5](#ref-5)], their integration into low-power indoor monitoring networks remains limited.

**Research Gap:** There is a distinct lack of localized and adaptive edge-native IoT monitoring systems that combine unsupervised micro-climate anomaly detection with low-power mesh networking and fog-assisted processing. This project addresses this gap by coupling a Thread-based CoAP sensor network with a localized Gateway-Tier Fog backend, integrating anomaly detection, trend analysis, and Explainable AI into a cohesive, edge-deployable system [[3](#ref-3)].

## 4. Proposed System Architecture

### 4.1 Environmental Parameters & Sensor Mapping
The system employs a suite of complementary sensors, measuring distinct environmental parameters mapped to international health guidelines (ASHRAE, WHO, EPA). Sensor readings are transmitted via CoAP over Thread.

| Measurement | Hardware | Typical Indoor Range | Health Guideline Threshold |
| :--- | :--- | :--- | :--- |
| **CO2** | Sensirion SCD41 | 400 - 1000 ppm | > 1500 ppm (ASHRAE 62.1) |
| **Humidity** | Sensirion SCD41 | 30% - 60% | > 70% or < 20% (ASHRAE 55) |
| **Temperature** | Microchip MCP9808 | 19°C - 28°C | > 35°C or < 10°C (ASHRAE 55) |
| **PM 2.5 / PM 10** | Sensirion SPS30 | 0 - 45 µg/m³ | > 35 µg/m³ (WHO / EPA) |
| **TVOC** | Adafruit CCS811 | 0 - 500 ppb | > 1000 ppb (WELL v2) |

### 4.2 Architecture Layers (Gateway-Tier Fog)
The system logically decouples microservices on a local Gateway-Tier Fog appliance to reduce latency and minimize external internet dependency.

| Layer | Component | Technology | Role |
| :--- | :--- | :--- | :--- |
| **Hardware Node** | nRF52840 DK | ARM Cortex-M4, OpenThread | Sensor acquisition & CoAP transmission. |
| **Edge Gateway** | Serial Gateway | Python 3.12, pyserial | Serial-to-HTTP bridge, telemetry ingestion. |
| **Backend API**| Spring Boot | Java 21, Spring Boot 3.3 | Telemetry routing, evaluation, and persistence. |
| **ML Engine** | ML Service | Python, FastAPI, scikit-learn | Isolation Forest, Trend Analysis, & XAI execution. |
| **Database** | Timeseries DB | MongoDB 7 | Telemetry and historical context persistence. |
| **Presentation** | Dashboard | React, Vite | Visualization and alert interpretation. |

### 4.3 Wireless Protocol Justification (OpenThread & CoAP)
OpenThread (IPv6) was selected for the hardware nodes to address the strict power and reliability constraints of indoor monitoring:
- **Energy Efficiency:** Thread operates as a low-power wireless mesh network, allowing battery-operated sensor nodes to run continuously without excessive power draw.
- **Self-Healing Mesh Topology:** Thread natively forms a self-healing mesh, allowing packets to route automatically around physical obstacles (e.g., concrete walls) without requiring a direct line-of-sight to the gateway [[7](#ref-7)].
- **Data Reliability (CoAP):** The system utilizes CoAP over Thread, supporting `CONFIRMABLE` message delivery. This mitigates packet loss and enhances the robustness of telemetry ingestion, a strict requirement for accurate machine learning evaluation [[8](#ref-8)].
- **Scalability:** For multi-floor deployments, OpenThread nodes act as low-power routers, bouncing telemetry to a central gateway, thereby reducing infrastructure overhead.

## 5. Intelligent Analysis & Alerting

### 5.1 Machine Learning Pipeline
The system avoids heavy, cloud-dependent Deep Learning models in favor of lightweight, Edge-native algorithms suitable for Fog Computing:
- **Anomaly Detection (Isolation Forest):** Analyzes multi-dimensional sensor data to generate a dynamic, rolling baseline for individual micro-climates. Isolation Forest is utilized due to its linear time complexity, minimal memory footprint, and unsupervised nature [[1](#ref-1), [2](#ref-2)].
- **Trend Analysis (Sliding Window Linear Regression):** Provides early warning indicators for primary environmental parameters and pollutant concentrations (e.g., CO2, PM2.5, TVOC, Temperature). By capturing short-term local trends using a sliding window, the system provides lightweight predictive support suitable for resource-constrained edge environments. Prior IIoT research has shown that many deep-learning-based sliding-window forecasting approaches introduce higher computational overhead and runtime complexity in low-latency deployments [[5](#ref-5)].
- **Explainable AI (XAI) & Interpretability:** To prevent opaque alerting, the ML engine implements a lightweight XAI layer. During an anomaly, the system calculates a baseline deviation ranking, providing interpretable contextual feedback directly to the operator to improve situational awareness.

### 5.2 Layered Alerting Model
The platform employs a four-tier alerting model:
1. **Deterministic Safety Alerts:** Synchronous notifications triggered when metrics breach established health guidelines.
2. **Behavioral Anomaly Alerts:** Asynchronous alerts triggered when multi-variable patterns deviate from the established micro-climate baseline.
3. **Early Warning Indicators:** Proactive notifications triggered when trend analysis suggests a potential threshold breach.
4. **Infrastructure Notifications:** Continuous monitoring of hardware health, evaluating Thread node reachability and gateway connectivity.

## 6. Hazard Analysis & Reliability
Given the context of environmental monitoring, the system implements mitigation strategies for operational and distributed system hazards:

| Hazard / Failure Mode | Mitigation / Reliability Strategy |
| :--- | :--- |
| **ML Calibration Phase** | Deterministic safety limits remain active independently during model warm-up. |
| **Model Drift (False Positives)** | Isolation Forest utilizes a rolling 24-hour window, automatically absorbing slow environmental drift. |
| **Network Loss (No ISP)** | Fog-Native architecture allows local LAN users to receive alerts even without external internet. |
| **CoAP/UDP Packet Loss** | CoAP `CONFIRMABLE` messages enforce acknowledgments, triggering retransmissions to reduce data gaps. |
| **Mesh Node Failure** | Thread multipath routing bypasses dead nodes. Isolated nodes utilize onboard flash for temporary Store-and-Forward buffering. |
| **Sensor Drift / Failure** | Plausibility validation, stuck-value detection, and cross-sensor consistency checks. |
| **Gateway / Service Crash** | Redundant Docker restart policies, heartbeat monitoring, and decoupled deterministic safety thresholds. |

## 7. Evaluation Methodology
To validate the proposed system, the following evaluation metrics will be measured during the testing phase:
- **Network Performance:** Thread mesh reliability, telemetry latency, and packet delivery ratio under simulated indoor interference.
- **ML Effectiveness:** Anomaly detection accuracy, false positive rate, and the convergence speed of the Isolation Forest during the calibration phase.
- **System Scalability & Resource Utilization:** CPU/Memory footprint of the Gateway-Tier Fog microservices and response times of the Spring Boot API under increased simulated node loads.

## 8. Limitations & Expected Outcomes
**Limitations:**
- **Deployment Scale:** Current physical validation is constrained to a localized indoor environment utilizing a single physical sensor node. The proposed architecture is designed to support scalable multi-node OpenThread mesh deployments.
- **Training Duration:** The rolling baseline relies on a 24-hour window, meaning long-term seasonal environmental changes will not be captured in the immediate dataset.
- **Hardware Constraints:** The lightweight nature of the ML models restricts the implementation of highly complex, multi-layered predictive neural networks.

**Expected Outcomes:**
The project aims to deliver a fully functional, end-to-end prototype that demonstrates the viability of combining low-power Thread mesh networking with localized, edge-native anomaly detection. The resulting architecture will provide a reproducible framework for privacy-preserving, intelligent indoor monitoring.

## 9. Project Management Summary

### 9.1 Project Team
| Team Members | Role | Responsibilities |
| :--- | :--- | :--- |
| **M. F. Mufti / M. Anwar** | Embedded Systems Engineer | OpenThread firmware, sensor integration, CoAP communication |
| **M. I. Hussain** | Machine Learning Engineer | Anomaly detection, trend analysis, XAI integration |
| **H. T. Khan / M. Saleem** | Backend & Database Engineer | Ingestion API, database schema design, persistence |
| **H. T. Khan / S. A. Minhas** | Frontend Developer | Dashboard UI/UX, visualization, frontend integration |
| **M. Anwar / M. Saleem** | Gateway & Infrastructure Engineer | Serial Gateway development, Docker orchestration |
| **M. Anwar / S. A. Minhas** | Scrum Master & Documentation Lead | Sprint planning, technical documentation, presentations |

### 9.2 Sprint Schedule
The project utilizes an Agile framework with one-week sprints over a 10-week lifecycle, executing cross-functional development tracks concurrently:
| Sprint | Concurrent Cross-Functional Tracks |
| :--- | :--- |
| **Sprint 1-2** | OpenThread sensor provisioning (Embedded) & database schema design (Backend) |
| **Sprint 3-4** | Serial Gateway bridging (Infrastructure) & React UI/UX development (Frontend) |
| **Sprint 5-6** | CoAP-to-HTTP telemetry ingestion (Backend) & Isolation Forest / Trend Analysis (ML) |
| **Sprint 7-8** | Explainable AI alert integration (ML) & real-time Dashboard data binding (Frontend) |
| **Sprint 9-10** | Docker orchestration, system calibration, and academic documentation (Cross-Functional) |

### 9.3 Workload Estimation
A hybrid approach combining Bottom-Up Estimation and Complexity-Based Estimation was adopted, yielding a total workload of approximately 600 cumulative team hours over the 10-week lifecycle. Subsystem tasks were individually estimated and refined based on technical complexity, with additional effort allocated to high-risk components including Thread/CoAP network validation, ML baseline calibration, and Docker multi-service orchestration.

| Estimation Method | Purpose |
| :--- | :--- |
| **Bottom-Up Estimation** | Subsystem-level workload estimation and task allocation |
| **Complexity-Based Estimation** | Integration, technical risk, and complexity evaluation |

---

## 10. References

### A. Communication standards
1. **IEEE 802.15.4**: IEEE Std 802.15.4-2020, "IEEE Standard for Low-Rate Wireless Networks." Available: [https://standards.ieee.org/ieee/802.15.4/7027/](https://standards.ieee.org/ieee/802.15.4/7027/)
2. **RFC 7252 (CoAP)**: Z. Shelby, K. Hartke, and C. Bormann, "The Constrained Application Protocol (CoAP)." Available: [https://datatracker.ietf.org/doc/html/rfc7252](https://datatracker.ietf.org/doc/html/rfc7252)
3. **RFC 8949 (CBOR)**: C. Bormann and P. Hoffman, "Concise Binary Object Representation (CBOR)." Available: [https://datatracker.ietf.org/doc/html/rfc8949](https://datatracker.ietf.org/doc/html/rfc8949)

### B. Environmental standards
4. **ASHRAE 55**: ASHRAE Standard 55, "Thermal Environmental Conditions for Human Occupancy." Available: [https://www.ashrae.org/](https://www.ashrae.org/technical-resources/bookstore/standard-55-thermal-environmental-conditions-for-human-occupancy)
5. **ASHRAE 62.1**: ASHRAE Standard 62.1, "Ventilation for Acceptable Indoor Air Quality." Available: [https://www.ashrae.org/](https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2)
6. **WHO AQG**: World Health Organization, "WHO Global Air Quality Guidelines," 2021. Available: [https://www.who.int/publications/i/item/9789240034228](https://www.who.int/publications/i/item/9789240034228)
7. **EPA NAAQS**: U.S. Environmental Protection Agency, "National Ambient Air Quality Standards (NAAQS)." Available: [https://www.epa.gov/criteria-air-pollutants/naaqs-table](https://www.epa.gov/criteria-air-pollutants/naaqs-table)
8. **WELL v2**: International WELL Building Institute, "WELL Building Standard v2." Available: [https://v2.wellcertified.com/](https://v2.wellcertified.com/)

### C. Hardware references
9. **SCD41**: Sensirion AG, "SCD4x CO2 Sensor Datasheet." Available: [Sensirion SCD4x PDF](https://sensirion.com/media/documents/48C4B7FB/64C2871A/Sensirion_CO2_Sensors_SCD4x_Datasheet.pdf)
10. **SPS30**: Sensirion AG, "SPS30 Particulate Matter Sensor Datasheet." Available: [Sensirion SPS30 PDF](https://sensirion.com/media/documents/8600FF88/616542B5/Sensirion_PM_Sensors_SPS30_Datasheet.pdf)
11. **CCS811**: ScioSense, "CCS811 Ultra-Low Power Digital Gas Sensor Datasheet." Available: [ScioSense CCS811 PDF](https://www.sciosense.com/wp-content/uploads/2023/12/CCS811-Datasheet.pdf)

### D. Machine-learning references
12. **Isolation Forest**: F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," *Eighth IEEE International Conference on Data Mining*, 2008.
13. **Scikit-Learn**: Scikit-Learn Developers, "sklearn.ensemble.IsolationForest Documentation." Available: [Scikit-Learn API](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)

### E. Academic Literature
14. E. Ortega, F. Su, R. Chattopadhyay, and K. Chakrabarty, "Discretized-Isolation Forest: Memory- and Compute-Efficient Unsupervised Anomaly Detection for Resource-Constrained Internet of Things Edge Devices," *IEEE Internet of Things Journal*, 2025.
15. Y. Wu, H.-N. Dai, and H. Tang, "Graph Neural Networks for Anomaly Detection in Industrial Internet of Things," *IEEE Internet of Things Journal*, 2022.
16. S. Guha and A. Datta, "GDRNet: A Deep Learning Framework for Dynamic Sliding Window Determination and Improved Prediction Accuracy in Online IIoT Systems," *IEEE Access*, 2025.
17. S. B. A. Khattak, M. M. Nasralla, H. Farman, and N. Choudhury, "Performance Evaluation of an IEEE 802.15.4-Based Thread Network for Efficient Internet of Things Communications in Smart Cities," *Applied Sciences (MDPI)*, 2023.
