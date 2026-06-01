# BLE Smart Monitoring Dashboard

Modern industrial-style React monitoring dashboard for the **BLE-Based Smart Indoor Environmental Monitoring System**.

This dashboard consumes real-time telemetry from the Spring Boot backend APIs and presents environmental sensor data through professional data visualisations, node monitoring panels, and alert tracking — designed to feel like a real industrial IoT monitoring platform.

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                React Dashboard (Vite)                     │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                │
│  │ Dashboard │  │  Nodes   │  │  Alerts  │   Pages        │
│  │   Page    │  │   Page   │  │   Page   │                │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                │
│       │              │              │                      │
│  ┌────┴──────────────┴──────────────┴──┐                  │
│  │          usePolling Hook            │  Auto-refresh     │
│  └────────────────┬────────────────────┘                  │
│                   │                                        │
│  ┌────────────────┴────────────────────┐                  │
│  │         API Service Layer           │  Axios            │
│  │  GET /api/sensor-data               │                  │
│  │  GET /api/nodes                     │                  │
│  │  GET /api/alerts                    │                  │
│  └────────────────┬────────────────────┘                  │
└───────────────────┼───────────────────────────────────────┘
                    │ HTTP
                    ▼
         ┌────────────────────┐
         │  Spring Boot API   │
         │  :8080             │
         └────────────────────┘
```

---

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.x | UI framework |
| Vite | 8.x | Build tool & dev server |
| Material UI (MUI) | 6.x | Component library & dark theme |
| Recharts | 2.x | Data visualisation (area charts) |
| Axios | 1.x | HTTP client for backend APIs |
| Inter (font) | — | Modern typography |
| Nginx | Alpine | Production static serving |
| Docker | — | Containerisation |

---

## Dashboard Features

### 1. Overview Summary Cards
- Average Temperature across all nodes
- Average Air Quality Index
- Average Light Intensity
- Active Sensor Nodes (online count)
- Active Alerts (unacknowledged count)

### 2. Real-Time Telemetry Charts
- Temperature trends (area chart with gradient fill)
- Air Quality Index trends
- Light Intensity trends
- Auto-refreshing at configurable intervals

### 3. Node Monitoring Panel
- All registered sensor nodes in card grid
- Online/Offline status indicators
- Last-seen timestamps
- Node registration dates

### 4. Alerts Panel
- Severity-coded alert chips (CRITICAL, WARNING, INFO)
- Alert type labels
- Trigger values vs. threshold values
- Full alert history table

### 5. Recent Telemetry Feed
- Live data table with latest readings
- Node identification chips
- Formatted timestamps

---

## Project Structure

```
ble-smart-monitoring-dashboard/
├── src/
│   ├── main.jsx                        # App entry point
│   ├── App.jsx                         # Root component with routing
│   ├── theme.js                        # MUI dark theme configuration
│   ├── index.css                       # Global styles
│   ├── config/
│   │   └── api.js                      # API endpoints & polling config
│   ├── services/
│   │   └── api.js                      # Axios service layer
│   ├── hooks/
│   │   └── usePolling.js               # Auto-refresh data hook
│   ├── utils/
│   │   └── format.js                   # Timestamp & math utilities
│   ├── layouts/
│   │   └── DashboardLayout.jsx         # App shell (sidebar + AppBar)
│   ├── components/
│   │   ├── StatCard.jsx                # KPI summary card
│   │   ├── SectionHeader.jsx           # Section title component
│   │   ├── StatusChip.jsx              # Online/Offline indicator
│   │   ├── LoadingOverlay.jsx          # Loading spinner
│   │   └── ErrorBanner.jsx             # API error banner
│   ├── charts/
│   │   └── TelemetryChart.jsx          # Recharts area chart
│   └── pages/
│       ├── DashboardPage.jsx           # Main monitoring overview
│       ├── NodesPage.jsx               # Sensor node panel
│       └── AlertsPage.jsx              # Alert management
├── public/
├── index.html                          # HTML entry point
├── vite.config.js                      # Vite configuration
├── nginx.conf                          # Production Nginx config
├── Dockerfile                          # Multi-stage Docker build
├── docker-compose.yml                  # Standalone orchestration
├── package.json
├── .env.example                        # Environment template
└── .gitignore
```

---

## Getting Started

### Prerequisites

- **Node.js 20+** and npm
- **Spring Boot backend** running at `http://localhost:8080`

### Local Development

1. **Install dependencies**:
   ```bash
   cd ble-smart-monitoring-dashboard
   npm install
   ```

2. **Configure environment** (optional):
   ```bash
   cp .env.example .env
   # Edit VITE_API_BASE_URL if backend is not on localhost:8080
   ```

3. **Start dev server**:
   ```bash
   npm run dev
   ```

4. **Open browser**: http://localhost:5173

### Docker

1. **Build and run**:
   ```bash
   docker compose up --build -d
   ```

2. **Open browser**: http://localhost:3000

3. **Stop**:
   ```bash
   docker compose down
   ```

---

## API Integration

The dashboard consumes three backend REST endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sensor-data` | GET | Telemetry readings for charts & feed |
| `/api/nodes` | GET | Registered nodes and their status |
| `/api/alerts` | GET | Alert history and severity data |

Data is auto-refreshed every 10 seconds (configurable via `VITE_POLL_INTERVAL`).

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:8080` | Backend API base URL |
| `VITE_POLL_INTERVAL` | `10000` | Data refresh interval (ms) |

---

## Theme

The dashboard uses a custom dark industrial theme:

| Element | Value | Description |
|---------|-------|-------------|
| Background | `#0B1120` | Deep navy |
| Card surface | `#111827` | Elevated surface |
| Primary | `#3B82F6` | Vibrant blue accent |
| Secondary | `#10B981` | Emerald green (online/success) |
| Error | `#EF4444` | Red (alerts/offline) |
| Warning | `#F59E0B` | Amber (warning alerts) |
| Font | Inter | Modern sans-serif |

---

## Future Notes

- When real BLE hardware is integrated, the dashboard requires **no changes** — it consumes the same backend REST APIs regardless of whether telemetry originates from the simulator or real Nordic nRF52840 nodes
- The chart components auto-scale to any data volume
- The polling mechanism can be upgraded to WebSocket for sub-second updates if needed

---

## License

MIT
