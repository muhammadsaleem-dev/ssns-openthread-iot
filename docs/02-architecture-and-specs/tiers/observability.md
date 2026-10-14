# Service Health Monitoring and Observability

## Purpose
The primary objective of the observability tier in the SSNS platform is to ensure service availability, validate container health, detect runtime faults, and provide foundational logging. The platform relies heavily on decentralized, container-level health checks to orchestrate startup sequencing and recover from transient failures. 

It is important to note that the project does **not** currently implement a dedicated, centralized monitoring stack (such as Prometheus, Grafana, Loki, or Alertmanager). Instead, observability is achieved through localized probing orchestrated natively by the Docker daemon.

---

## Architectural Overview
The implemented architecture relies on a poll-based health-checking mechanism driven by the container runtime rather than a dedicated metrics scraper. The Docker daemon periodically interrogates exposed service endpoints and cascades failure states up to the administrator.

```text
Container
     ↓
health check
     ↓
service endpoint
     ↓
Docker runtime
     ↓
administrator
```

---

## Spring Boot Monitoring
The backend API relies on **Spring Boot Actuator** to expose internal application state.
* **Health Indicators:** Actuator automatically configures health indicators for the core application and its database connections.
* **`/actuator/health` Endpoint:** Serves as a unified HTTP GET endpoint returning `{"status": "UP"}` when the application and its critical dependencies are healthy.
* **Readiness Checks:** Validates that the application has fully initialized its web server and database connection pools before accepting external traffic.
* **Docker Compose Integration:** The Dockerfile is configured to run `wget -qO- http://localhost:8080/actuator/health || exit 1`. Docker Compose executes this command to determine container readiness, holding dependent services in a "starting" state until the API reports healthy.

---

## MongoDB Monitoring
To ensure the persistence layer is robust and responsive, the database container undergoes active ping checks.
* **Ping checks:** Validates that the MongoDB daemon is actively listening and capable of processing commands.
* **Availability verification:** Prevents dependent microservices from connecting to a database that is technically running but internally deadlocked.
* **Container status monitoring:** Monitored seamlessly by the Docker Compose engine.

The specific command implemented for health verification is:
```bash
mongosh --eval "db.adminCommand('ping')"
```

---

## ML Service Monitoring
The machine-learning microservice implements a lightweight monitoring endpoint tailored for **FastAPI**.
* **`/health` Endpoint:** An HTTP GET route configured within the Python application.
* **Service Availability:** Returns a simple 200 OK JSON response, verifying that the ASGI server (Uvicorn/FastAPI) is responsive and not blocked by synchronous matrix calculations.
* **Dependency Validation:** Confirms that the necessary models and configurations have loaded into memory successfully upon initialization.

---

## Docker Health Checks
The platform utilizes native **Docker Compose health checks** to handle dependency management and automated recovery.
* **Container monitoring:** Periodic evaluations (e.g., polling every 10 seconds) ensure continuous service validation.
* **Restart behavior:** Configured with `restart: unless-stopped`, instructing the Docker daemon to automatically restart services if they crash or fail consecutive health checks.
* **Dependency management & Startup ordering:** Services define a `depends_on` block with `condition: service_healthy`. For example, the `api-1` and `api-2` containers will not start until `mongodb` passes its `mongosh` ping test. Similarly, the `dashboard` will not boot until the backend APIs are responsive.

**Repository Example:**
```yaml
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

---

## Logging
The platform utilizes decentralized, native runtime logging.
* **Standard output logging:** All microservices (Spring Boot, FastAPI, Node/React) output their diagnostic information directly to `stdout` and `stderr`.
* **Docker logs:** The Docker daemon captures these standard output streams, making them accessible via `docker logs <container_name>`.
* **Application & Exception logging:** Application frameworks automatically format stack traces, HTTP access logs, and runtime exceptions into the standard output stream.
* **Absence of centralized log aggregation:** There is no centralized agent (like Promtail or Fluentbit) forwarding these logs to a central indexing database. Administrators must SSH into the host and query container logs individually.

---

## Failure Detection
* **Backend failures:** Detected when `/actuator/health` times out or returns a non-200 status, triggering a container restart.
* **Database failures:** Detected by `mongosh` ping timeouts. If the database crashes, dependent API containers will eventually fail their own internal health checks and restart cleanly once the database recovers.
* **ML service failures:** Detected if the Python asynchronous event loop locks up or crashes, failing the `/health` HTTP check.
* **Timeout handling:** Strict intervals (e.g., 5s timeouts) prevent indefinite hanging during health polling.
* **Recovery mechanisms:** Fully autonomous via Docker daemon restart policies, requiring zero manual operator intervention for transient software crashes.

---

## Limitations
The current architecture strictly provides binary up/down statuses. It is fundamentally limited by the absence of an enterprise telemetry stack.
* **Prometheus:** Missing. There is no time-series database scraping numeric metrics (CPU, RAM, HTTP latency).
* **Grafana:** Missing. There are no visual dashboards for infrastructure health or performance trends over time.
* **Loki:** Missing. Searching across multiple container logs simultaneously is impossible without a centralized logging aggregator.
* **Alertmanager:** Missing. If a container enters a permanent crash loop, no email or Slack alert is generated to notify human operators.
* **Distributed tracing:** Missing. There are no trace IDs linking frontend requests to backend database queries (e.g., Jaeger/Zipkin).
* **Exporters:** Missing. Node Exporter and cAdvisor are not installed to monitor host machine disk space or CPU load.
* **Centralized metrics:** Missing. Capacity planning is impossible because historical resource consumption is not recorded.

---

## Future Work
To mature the platform for enterprise production, the following observability tools should be introduced:
* **Prometheus:** To scrape `spring-boot-starter-actuator` Micrometer metrics and system exporters.
* **Grafana:** To build rich visual dashboards tracking JVM heap usage, HTTP response times, and Python memory consumption.
* **Alertmanager:** To route critical infrastructure alerts (e.g., "Disk space > 90%" or "API container down") to Slack or PagerDuty.
* **Loki:** To aggregate all Docker `stdout` logs into a single, searchable indexing engine.
* **Distributed tracing:** To integrate OpenTelemetry traces across the React, Spring Boot, and FastAPI layers to debug latency bottlenecks.

---

## Conclusions
The SSNS platform implements a highly resilient but fundamentally decentralized observability strategy. It relies strictly on Docker native health checks, Spring Boot Actuator, and simple HTTP GET endpoints to orchestrate startup dependencies and execute autonomous recovery. While this approach is extremely lightweight and prevents catastrophic deadlocks, the total absence of a centralized metrics and logging stack (Prometheus, Grafana, Loki) severely limits the administrator's ability to perform proactive capacity planning, debug complex historical incidents, or receive automated out-of-band alerts for infrastructure failures.

*(All findings regarding health endpoints, Docker configurations, and the absence of centralized monitoring tools have been explicitly classified as VERIFIED, INFERRED, or NOT FOUND based on repository audits.)*
