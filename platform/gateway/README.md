# OpenThread Smart Monitoring Gateway

Python-based OpenThread gateway simulator for the **OpenThread-Based Smart Indoor Environmental Monitoring System**.

This gateway acts as a communication bridge between sensor nodes and the Spring Boot backend. It currently simulates OpenThread telemetry from multiple environmental sensor nodes and forwards data to the backend REST API. The architecture is designed so that switching from simulated to real OpenThread hardware requires changes in **only one module**.

---

## Architecture

```
┌───────────────────────────────────────────────────────┐
│                  OpenThread Gateway                          │
│                                                       │
│  ┌─────────────────┐                                  │
│  │ TelemetrySource │ ◄── Abstract interface           │
│  └──────┬──────────┘                                  │
│         │                                             │
│         ├── SimulatedTelemetrySource  (current)       │
│         │   Generates realistic sensor data           │
│         │                                             │
│         └── BleTelemetrySource       (future)         │
│             Reads real OpenThread data via CoAP             │
│                                                       │
│  ┌─────────────────┐                                  │
│  │  HttpForwarder   │                                 │
│  │  POST /api/      │ ──── unchanged regardless ────► │
│  │  sensor-data     │      of data source             │
│  └─────────────────┘                                  │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Spring Boot Backend  │
              │  POST /api/sensor-data│
              └───────────────────────┘
```

### Data Flow

```
SimulatedTelemetrySource          HttpForwarder          Backend
        │                              │                    │
        │  TelemetryReading[]          │                    │
        ├─────────────────────────────►│                    │
        │                              │  POST JSON         │
        │                              ├───────────────────►│
        │                              │  201 Created       │
        │                              │◄───────────────────┤
        │                              │                    │
```

---

## Gateway Responsibilities

| Responsibility | Description |
|---------------|-------------|
| Telemetry acquisition | Simulate (or receive) environmental sensor data |
| Data normalisation | Convert readings to canonical `TelemetryReading` format |
| HTTP forwarding | POST JSON payloads to the backend REST API |
| Error resilience | Handle connection failures without crashing |
| Structured logging | Log all telemetry generation, forwarding, and errors |
| Graceful shutdown | Clean exit with uptime and transmission statistics |

> **Important**: The gateway is a _communication bridge_. It does not implement business logic, alert evaluation, or data persistence — those responsibilities belong to the backend.

---

## Technology Stack

| Technology | Purpose |
|-----------|---------|
| Python 3.12 | Runtime |
| `requests` | HTTP client for backend communication |
| `python-dotenv` | Environment-based configuration |
| Docker | Containerisation |
| _CoAP (future)_ | _OpenThread communication with nRF52840 hardware_ |

---

## Project Structure

```
openthread-smart-monitoring-gateway/
├── main.py                         # Gateway entry point and lifecycle
├── config/
│   ├── __init__.py
│   └── settings.py                 # Configuration loading and validation
├── telemetry/
│   ├── __init__.py
│   ├── model.py                    # TelemetryReading data model
│   └── source.py                   # TelemetrySource abstract interface
├── simulator/
│   ├── __init__.py
│   └── simulated_source.py         # Simulated telemetry generator
├── forwarding/
│   ├── __init__.py
│   └── http_forwarder.py           # HTTP POST to backend API
├── logging_/
│   ├── __init__.py
│   └── logger.py                   # Structured logging configuration
├── utils/
│   ├── __init__.py
│   └── helpers.py                  # Shared utility functions
├── Dockerfile                      # Container build
├── docker-compose.yml              # Standalone orchestration
├── requirements.txt                # Python dependencies
├── .env.example                    # Environment variable template
└── .gitignore
```

---

## Getting Started

### Prerequisites

- Python 3.10+ (3.12 recommended)
- Spring Boot backend running at `http://localhost:8080`

### Local Development

1. **Create virtual environment**:
   ```bash
   cd openthread-smart-monitoring-gateway
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit .env to adjust settings
   ```

4. **Run the gateway**:
   ```bash
   python main.py
   ```

5. **Run with custom settings**:
   ```bash
   BACKEND_URL=http://localhost:8080/api/sensor-data \
   TELEMETRY_INTERVAL=5 \
   NODE_COUNT=6 \
   LOG_LEVEL=DEBUG \
   python main.py
   ```

### Docker

1. **Build and run**:
   ```bash
   docker compose up --build -d
   ```

2. **View logs**:
   ```bash
   docker compose logs -f gateway
   ```

3. **Stop**:
   ```bash
   docker compose down
   ```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_URL` | `http://localhost:8080/api/sensor-data` | Backend ingestion endpoint |
| `TELEMETRY_INTERVAL` | `10` | Seconds between telemetry cycles |
| `NODE_COUNT` | `4` | Number of simulated sensor nodes |
| `LOG_LEVEL` | `INFO` | Logging verbosity (DEBUG/INFO/WARNING/ERROR) |
| `TELEMETRY_SOURCE` | `simulator` | Source of telemetry (`simulator` or `openthread`) |

Configuration is loaded from (in priority order):
1. OS environment variables
2. `.env` file (via python-dotenv)
3. Built-in defaults

---

## Telemetry Simulation

The `SimulatedTelemetrySource` generates realistic environmental data:

| Parameter | Range | Behaviour |
|-----------|-------|-----------|
| Temperature | 18–33°C | Per-node baseline with ±2°C drift |
| Light intensity | 50–1000 lux | Per-node baseline with ±100 lux drift |
| MQ135 Raw | 10–1000 | Per-node baseline with ±10 drift |
| CO2 Equivalent | 400+ ppm | Derived realistically from MQ135 Raw |
| Air Quality Level | 0–100 | Scaled representation of MQ135 Raw |

Each simulated node maintains its own baseline values that gradually drift over time, producing believable time-series data rather than purely random values.

### Telemetry Payload

```json
{
  "nodeId": "node-01",
  "temperature": 24.5,
  "lightIntensity": 320.0,
  "airQualityLevel": 61.5,
  "co2Equivalent": 450.2,
  "mq135Raw": 125.0,
  "timestamp": "2026-05-12T14:22:00.000000+00:00"
}
```

> **Note on MQ135 Raw:** The raw analogue reading from the MQ135 sensor is preserved in the payload. While the gateway derives basic CO2 and Air Quality metrics for immediate dashboard use, the raw signal is stored to enable future Machine Learning (ML) analytics and advanced baseline calibration on the backend.

---

## Backend Integration

The gateway forwards telemetry to the Spring Boot backend using:

```
POST http://localhost:8080/api/sensor-data
Content-Type: application/json
```

The `HttpForwarder` handles:
- ✓ Successful transmissions (HTTP 200/201)
- ✗ Connection failures (backend unreachable)
- ✗ Timeouts (backend unresponsive)
- ✗ Rejection responses (HTTP 4xx/5xx)

All outcomes are logged with structured messages.

---

## Future OpenThread Integration (Nordic nRF52840)

The gateway architecture is specifically designed to minimise changes when transitioning from simulated to real OpenThread telemetry.

### What Changes

| Component | Current | Future | Changes Required |
|-----------|---------|--------|-----------------|
| `simulator/simulated_source.py` | Generates fake data | **Inactive** if OpenThread used | — |
| `telemetry/openthread_source.py` | Skeleton structure | Active source | Finalize CoAP parsing |
| `telemetry/source.py` | Abstract interface | Unchanged | — |
| `telemetry/model.py` | Data model | Unchanged | — |
| `forwarding/http_forwarder.py` | HTTP POST | Unchanged | — |
| `config/settings.py` | Config loading | Minor additions | OpenThread scan parameters |
| `main.py` | Orchestrator | One-line change | Swap source instantiation |
| `logging_/` | Logging | Unchanged | — |
| `utils/` | Helpers | Unchanged | — |

### What Stays the Same

> The telemetry processing and HTTP forwarding layers remain **completely unchanged**. Only the telemetry acquisition/source layer switches from simulated telemetry generation to real OpenThread packet reception using CoAP.

### Migration Steps

1. **Install CoAP**: Uncomment `bleak` in `requirements.txt`
2. **Create `BleTelemetrySource`**: Implement `TelemetrySource` interface using CoAP to scan/connect to nRF52840 nodes
3. **Update `main.py`**: Change one line — `source = BleTelemetrySource(...)` instead of `SimulatedTelemetrySource(...)`
4. **Add OpenThread config**: Extend `GatewayConfig` with scan interval, service UUIDs, etc.

### Example Future BleTelemetrySource

```python
from bleak import CoAPScanner
from telemetry.source import TelemetrySource
from telemetry.model import TelemetryReading

class BleTelemetrySource(TelemetrySource):
    async def read_telemetry(self):
        devices = await CoAPScanner.discover(timeout=5.0)
        readings = []
        for device in devices:
            # Parse OpenThread advertisement data from nRF52840
            reading = self._parse_openthread_data(device)
            if reading:
                readings.append(reading)
        return readings
```

---

## License

MIT
