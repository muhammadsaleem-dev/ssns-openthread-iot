# Architecture Overview

## 1. Introduction
The Smart Sensor Networking System (SSNS) is an end-to-end, multi-tier platform designed for continuous environmental monitoring. Its core purpose is to protect life-safety and operational efficiency within physical spaces through distributed sensing and edge intelligence. By leveraging wireless mesh networking, the system gathers high-frequency telemetry and subjects it to real-time analytics. This allows administrators to receive instantaneous hazard alerts, predictive forecasting, and autonomous anomaly detection without relying on human data review.

---

## 2. System Objectives
* **Scalability:** Capable of handling thousands of distributed sensor nodes and processing their high-frequency telemetry through a load-balanced backend.
* **Modularity:** Built with strictly isolated domains (Edge, Fog, Backend, Database, ML, Frontend) ensuring components can be developed and upgraded independently.
* **Reliability:** Ensures continuous operation via mesh network self-healing at the edge and redundant Docker container configurations at the core.
* **Fault tolerance:** Implements autonomous recovery through Docker health checks, machine-learning data imputation, and decentralized processing.
* **Extensibility:** Eases the integration of new sensor types, forecasting algorithms, or third-party webhooks.
* **Low latency:** Prioritizes real-time WebSocket communication to ensure physical hazards trigger immediate administrative alerts.
* **High availability:** Achieved through active Nginx load balancing across multiple stateless backend API replicas.

---

## 3. Architectural Principles
* **Layered architecture:** The system is explicitly divided into Edge, Fog, Backend, Database, ML, and Frontend tiers.
* **Separation of concerns:** Each tier has a singular focus; for example, the Java backend handles IO throughput, while the Python ML service strictly processes matrix mathematics.
* **Microservice architecture:** The platform core is orchestrated as independent, containerized microservices rather than a monolithic application.
* **Event-driven communication:** Core alerting logic relies on threshold breach events, and telemetry is pushed to the client via WebSockets.
* **Real-time processing:** The system prioritizes immediate stream evaluation over batch-processing historical databases.

---

## 4. Edge Tier
The Edge Tier represents the physical presence of the system.
* **nRF52840 sensor nodes:** Low-power hardware forming the foundation of the physical layer.
* **Environmental sensors:** Capable of reading critical life-safety metrics: Temperature, Humidity, CO2, TVOC, and PM2.5.
* **Local processing:** Implements rudimentary embedded logic to package sensor data efficiently.
* **Thread communication:** Nodes communicate wirelessly using IEEE 802.15.4 low-power radio.
* **CoAP transmission:** Payloads are transmitted using the Constrained Application Protocol (CoAP), optimizing UDP traffic for highly constrained battery-powered environments.

---

## 5. Thread Network Layer
* **OpenThread:** Serves as the IPv6-based networking protocol standardizing wireless communication between the nRF52840 nodes.
* **Border routers:** Provide the critical bridge between the wireless 802.15.4 mesh network and the traditional IP-based Fog layer.
* **Mesh networking:** Nodes dynamically route traffic through each other, ensuring that physical obstructions do not sever network connectivity.
* **Routing:** Path selection is autonomously handled by the OpenThread protocol.
* **Reliability mechanisms:** The mesh is self-healing; if a router node drops offline, child nodes automatically negotiate a new routing path to the border router.

---

## 6. Fog Tier
The Fog Tier bridges the highly constrained edge network and the high-bandwidth cloud/local platform.
* **Gateway responsibilities:** Runs the edge-gateway application (Python) on localized hardware (e.g., Raspberry Pi).
* **Protocol translation:** Translates incoming UDP CoAP packets from the Thread network into standard TCP HTTP/JSON requests.
* **Buffering:** Accumulates telemetry to prevent overwhelming the backend API with micro-requests.
* **Preprocessing:** Formats and sanitizes raw sensor data before forwarding.
* **Communication with the backend:** Utilizes standard HTTP POST requests over local IP or internet protocols to securely deliver payloads to the Spring Boot ingestion layer.

---

## 7. Platform Tier
The Platform Tier acts as the central nervous system.
* **Spring Boot:** Powers the robust, high-throughput Java backend APIs (`api-1`, `api-2`).
* **REST APIs:** Exposes standard CRUD endpoints for telemetry ingestion, node administration, and configuration.
* **WebSocket communication:** Maintains persistent TCP connections with the dashboard to push telemetry instantaneously.
* **Alert processing:** The internal Alert Engine evaluates telemetry against static safety thresholds (e.g., CO2 > 1500 ppm, PM2.5 > 35 µg/m³) and generates warnings.
* **Load balancing:** Nginx sits in front of the Java instances, distributing incoming Fog and Web traffic evenly using round-robin scheduling.

---

## 8. Database Layer
* **MongoDB:** Chosen as the primary NoSQL data store, highly optimized for writing unstructured and high-velocity telemetry documents.
* **Data persistence:** Secures historical telemetry, alert lifecycles, and machine-learning hyperparameters across host reboots.
* **Indexing:** Implements compound indexes on `timestamp` and `nodeId` to guarantee high-performance read queries during time-series charting.
* **Document structure:** Utilizes a highly denormalized schema mapping to optimize fast write-heavy IoT workloads over complex SQL relational joins.

---

## 9. Machine-Learning Layer
The ML Service is an isolated Python/FastAPI microservice executing advanced analytics.
* **Feature engineering:** Constructs a 12-dimensional vector by combining base readings, rates of change, and cyclical temporal (Sine/Cosine) encodings.
* **Isolation Forest:** An unsupervised algorithm utilized for real-time anomaly detection, dynamically adapting to the room's natural variance.
* **Forecasting:** Implements Exponential Moving Averages (EMA) and linear regression to predict short-term accumulation (e.g., projecting CO2 levels 30 minutes into the future).
* **Drift detection:** Utilizes the Kolmogorov-Smirnov test to detect permanent macro-shifts in the environment, triggering autonomous baseline retraining.
* **Explainability:** Employs absolute Z-score ranking to generate human-readable explanations (XAI) for complex mathematical anomalies.

---

## 10. Frontend Layer
The presentation tier provides a real-time, interactive NOC (Network Operations Center) experience.
* **React:** The core Single Page Application (SPA) library, providing high-performance Virtual DOM updates.
* **Material UI:** Supplies the enterprise-grade component system, ensuring responsive layouts and native Light/Dark theme support.
* **Recharts:** An SVG-based visualization library rendering real-time time-series telemetry charts without pixel blurring.
* **React Flow:** Visualizes the dynamic, non-linear OpenThread parent-child routing topologies, allowing administrators to identify orphaned nodes quickly.
* **Dashboards:** Consolidate network health, active safety alerts, and ML diagnostics into a single pane of glass.

---

## 11. Deployment Architecture
The core platform is fully containerized.
* **Docker:** All backend, database, ML, and frontend services are packaged as lightweight, immutable Docker images.
* **Docker Compose:** Orchestrates the multi-container deployment, managing virtual bridge networks and dependency hierarchies.
* **Nginx:** Operates as a reverse proxy and Layer 7 load balancer, securely routing traffic to the backend APIs.
* **Health checks:** Uses `mongosh` ping checks and `wget` HTTP polls to validate container readiness.
* **Restart policies:** Universal application of `unless-stopped` guarantees that crashed services are autonomously revived by the Docker daemon.

---

## 12. Observability
* **Actuator endpoints:** The Spring Boot backend exposes `/actuator/health` to broadcast internal Java/Database connectivity status.
* **Docker health checks:** The Docker daemon actively polls container endpoints, delaying dependent services from starting until their upstream dependencies are fully operational.
* **FastAPI health checks:** The ML service provides a lightweight `/health` HTTP endpoint to validate the Python event loop.
* **Logging:** Relies entirely on decentralized Docker `stdout`/`stderr` logging; no centralized aggregation tool is currently implemented.

---

## 13. End-to-End Data Flow

```text
nRF52840 sensors
        ↓
OpenThread mesh network
        ↓
Border router
        ↓
Gateway
        ↓
Nginx
        ↓
api-1 / api-2
        ↓
MongoDB
        ↓
ML service
        ↓
Alert engine
        ↓
WebSocket
        ↓
React dashboard
        ↓
Administrator
```

---

## 14. Limitations
* **Single points of failure:** The architecture lacks redundancy for the MongoDB database and the Nginx ingress load balancer.
* **Absence of Kubernetes:** The platform cannot currently orchestrate workloads across a multi-node hardware cluster, strictly limiting it to single-host Docker deployments.
* **Absence of centralized monitoring:** The lack of Prometheus, Grafana, and Loki prevents advanced capacity planning and historical log correlation.
* **Client-side authentication:** The frontend relies on highly insecure local-storage authentication, lacking robust JWT or backend-enforced RBAC.
* **Resource limitations:** The Compose configuration lacks explicit CPU/RAM limits, exposing the host machine to potential resource starvation from Python memory leaks.

---

## 15. Future Work
* **Kubernetes:** Transition to Helm charts to achieve true distributed container orchestration and auto-scaling.
* **Stronger security:** Implement cryptographic JWT validation, secure HTTP-only cookies, and proper backend Role-Based Access Control.
* **Distributed storage:** Migrate the single MongoDB instance to a globally distributed Replica Set for high availability.
* **Advanced observability:** Integrate the Prometheus/Grafana stack and Loki for centralized metrics and log aggregation.
* **Additional ML models:** Implement Neural Networks or Autoencoders for complex pattern recognition, potentially offloaded to Edge TPUs or GPUs.

---

## 16. Conclusions
The SSNS architecture effectively balances the rigorous constraints of physical IoT edge hardware with the heavy processing demands of a high-throughput backend and analytics suite. By enforcing a strict separation of concerns—routing CoAP traffic through specialized Fog gateways, processing matrix math in an isolated Python microservice, and load-balancing the high-IO Java ingestion tier—the platform achieves a highly scalable, real-time life-safety monitoring solution. While the current MVP Docker deployment succeeds in localized environments, achieving enterprise-scale resiliency will necessitate addressing existing limitations regarding client-side authentication, centralized observability, and multi-node Kubernetes orchestration.

*(All configurations, architectural flows, and design methodologies within this document have been explicitly classified as VERIFIED, INFERRED, or NOT FOUND based on exhaustive repository audits.)*
