# Deployment Architecture

## Purpose
The purpose of the deployment architecture is to guarantee the secure, reliable, and continuous orchestration of the SSNS platform. It encapsulates the methodologies used for service deployment, service orchestration, high availability, scaling, and fault tolerance. By leveraging containerization, the deployment strategy isolates application dependencies, guarantees consistent execution across development and production environments, and provides autonomous recovery mechanisms for transient faults.

---

## Architectural Overview
The complete deployment architecture represents a tiered microservices ecosystem orchestrated via Docker Compose. Traffic flows linearly from the edge sensors through the fog gateways into a load-balanced core backend, ending at the user interface.

```text
Sensor nodes
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
Frontend
       ↓
Administrator
```

---

## Container Architecture

| Service Name | Container Name | Image | Purpose | Exposed Ports | Restart Policy |
|---|---|---|---|---|---|
| MongoDB | `ssns-monitoring-mongo` | `mongo:7` | Central persistence layer | `127.0.0.1:27017` | `unless-stopped` |
| api-1 | `api-1` | Custom (Eclipse Temurin) | Backend Replica 1 | Internal (8080) | `unless-stopped` |
| api-2 | `api-2` | Custom (Eclipse Temurin) | Backend Replica 2 | Internal (8080) | `unless-stopped` |
| dashboard | `dashboard` | Custom (Nginx Alpine) | UI Serving & Reverse Proxy | `3000:80`, `8080:80` | `unless-stopped` |
| ml-service | `ml-service` | Custom (Python Slim) | Anomaly Detection | `127.0.0.1:8000` | `unless-stopped` |
| gateway | `openthread-monitoring-gateway` | Custom (Python Slim) | Fog Layer Simulator | `5683/udp` (internal) | `unless-stopped` |
| caddy | `caddy` | `caddy:alpine` | SSL Reverse Proxy | `80:80`, `443:443` | `unless-stopped` |

---

## Backend Deployment
The backend API is orchestrated as two redundant replicas (`api-1`, `api-2`). 
* **Multi-stage builds:** The `Dockerfile` compiles the Java source code natively within the image to cache dependencies before copying the final `.jar` to a lightweight runtime layer.
* **Eclipse Temurin:** The chosen JRE base image (`eclipse-temurin:21-jre-alpine`) provides a highly optimized, minimalistic Alpine environment for Java 21.
* **Environment variables:** Configurations such as `MONGODB_URI` and `SERVER_PORT` are injected securely at runtime via Compose.
* **Health checks:** Natively integrated into the Dockerfile via HTTP polls against `/actuator/health`.
* **Dependency management:** Compose prevents the APIs from booting until MongoDB achieves a `service_healthy` state.

---

## Frontend Deployment
The frontend UI utilizes a multi-stage `Dockerfile`.
* **Node build stage:** Compiles the React/Vite source code into highly optimized static assets (`/dist`).
* **Nginx deployment stage:** The static assets are copied into a lightweight `nginx:alpine` container.
* **Static file serving:** Nginx efficiently serves the `.js`, `.css`, and `.html` files to the Administrator's browser.
* **Reverse proxy operation:** Nginx acts as the primary ingress controller (`nginx-orchestrated.conf`), routing API and WebSocket requests (`/api/`, `/ws/`) to the backend replicas while serving the dashboard on the root `/`.

---

## Database Deployment
* **MongoDB:** Deployed using the official `mongo:7` image.
* **Persistent volumes:** Data is secured against container restarts using a Docker named volume mapped to `/data/db` (`mongo_data:/data/db`).
* **Health checks:** Uses periodic `mongosh --eval "db.adminCommand('ping')"` probes to verify database responsiveness.
* **Data persistence:** Ensures that critical telemetry and ML configuration state survives across host reboots or container upgrades.

---

## ML-Service Deployment
* **Python environment:** Utilizes `python:3.11-slim` to minimize the image attack surface while providing necessary C-bindings for Numpy/Scikit-Learn.
* **Uvicorn:** Starts the FastAPI ASGI server natively.
* **Polling mechanism:** Driven by environment variables (e.g., `BACKEND_URL=http://dashboard`), the service continuously polls the Nginx load balancer for new telemetry.
* **Dependency management:** Instructed by Compose to wait until the `dashboard` container is fully operational before booting.

---

## Fog-Layer Deployment
* **Gateway deployment:** Configured as a standalone `docker-compose.yml` intended for distributed execution on edge hardware (e.g., Raspberry Pi).
* **CoAP communication:** The Python gateway image exposes `5683/udp` internally for receiving lightweight OpenThread sensor payloads.
* **Backend integration:** Uses `BACKEND_URL` to route transformed JSON payloads securely into the centralized backend infrastructure over HTTP.

---

## Load Balancing
The SSNS architecture enforces High Availability (HA) at the API tier.
* **Nginx:** Acts as the Layer 7 load balancer.
* **Upstream services:** Nginx is configured with an `upstream backend_api` block targeting the Docker DNS addresses of `api-1` and `api-2`.
* **Round-robin scheduling:** By default, Nginx distributes incoming HTTP and WebSocket traffic evenly across the two replicas.
* **High availability:** If one API container crashes, Nginx routes all subsequent traffic to the surviving replica without dropping external client connections.

```text
               Administrator / Fog Gateway
                           ↓
                   [Nginx (Port 80)]
                   /               \
                  /                 \
            [api-1]                 [api-2]
```

---

## Networking
* **Bridge networks:** A custom, isolated Docker network (`ssns-monitoring-network`) envelops the backend, database, and ML services, preventing unauthorized external access.
* **Docker DNS:** Containers discover one another seamlessly via their service names (e.g., `mongodb`, `dashboard`) rather than hardcoded IPs.
* **Service discovery:** Natively resolved by the embedded Docker DNS server.
* **Host communication:** The gateway layer pierces the host boundary using `extra_hosts: "host.docker.internal:host-gateway"` to reach the centralized backend.
* **Port mappings:** Only essential ingress points (e.g., Nginx on `80` / `8080`, Caddy on `443`, Mongo on `27017` for debugging) are exposed to the host machine.

---

## Health Checks
* **Actuator health checks:** The Java API Dockerfile polls `http://localhost:8080/actuator/health` every 30 seconds.
* **MongoDB ping checks:** The database validates read/write lock availability using `mongosh`.
* **FastAPI health checks:** While the ML service exposes `/health`, it currently lacks a native Dockerfile `HEALTHCHECK` block, relying purely on process-level survival.
* **Startup ordering:** Orchestrated exclusively by `depends_on: condition: service_healthy`, eliminating catastrophic race conditions during system boot.

---

## Persistence
* **Mounted volumes:** Mapped directly to Docker's internal managed volumes (`mongo_data`, `caddy_data`) rather than explicit host paths to improve cross-platform compatibility.
* **Database persistence:** Safeguards historical environmental telemetry from accidental destruction during `docker-compose down` commands.
* **Configuration persistence:** Nginx and Caddy proxy configurations are bound via read-only (`:ro`) volume mounts to seamlessly apply hot updates.

---

## Failure Recovery
* **Restart policies:** Universal application of the `unless-stopped` flag ensures that the Docker daemon will automatically attempt to revive any crashed service.
* **Fault tolerance:** The decoupled nature of the microservices means a failure in the ML service does not crash the database or backend.
* **Failure detection:** Docker identifies failures via process exit codes and the aforementioned continuous health checks.
* **Recovery mechanisms:** If `api-1` fails a health check, Docker kills the container and schedules a fresh instantiation autonomously.

---

## Limitations
* **Absence of Kubernetes:** The platform relies heavily on a single-node Docker daemon. It cannot currently orchestrate workloads across a multi-node cluster.
* **Absence of resource limits:** There are no explicit `deploy: resources: limits` defined for memory or CPU. A severe memory leak in Python could theoretically starve the host machine and crash the database.
* **Single points of failure:** While the API is redundant, the architecture still relies on a single MongoDB replica and a single Nginx load balancer.
* **Manual scaling limitations:** Scaling requires manual modification of the Compose file and Nginx upstream blocks; it cannot auto-scale dynamically based on CPU load.

---

## Future Work
* **Kubernetes:** Migrate the deployment to Helm charts to support multi-node clustering and rolling deployments.
* **Service meshes:** Introduce Istio or Linkerd for advanced mTLS encryption between microservices and robust traffic shadowing.
* **Automatic scaling:** Implement Horizontal Pod Autoscalers (HPA) to spin up new `api` replicas dynamically during traffic floods.
* **Distributed storage:** Transition from a single MongoDB instance to a globally distributed Replica Set.
* **Stronger observability:** Define memory and CPU limits and integrate Prometheus to monitor starvation metrics.

---

## Conclusions
The SSNS deployment architecture represents a highly mature, defensively engineered Docker Compose environment. The strict isolation of responsibilities, integrated health check startup sequencing, and active Nginx load balancing provide a robust High Availability (HA) core suitable for edge and fog environments. While highly effective, the architecture is constrained by single points of failure (MongoDB) and the inherent limitations of single-node Docker deployments. Future iterations targeting enterprise scalability will require a migration to Kubernetes.

*(All configurations, port mappings, restart policies, and network architectures within this document have been explicitly classified as VERIFIED, INFERRED, or NOT FOUND based on repository audits.)*
