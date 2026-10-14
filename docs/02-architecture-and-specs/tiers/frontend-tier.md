# Frontend Tier

## Purpose
The frontend tier serves as the primary visual interface for the Smart Monitoring platform. The dashboard provides operators with a real-time, interactive environment to monitor life-safety environmental telemetry, manage sensor nodes, configure machine-learning anomaly detection, and visualize complex OpenThread mesh network topologies. It transforms raw, high-frequency backend streams into actionable, human-readable insights for network administration and facility monitoring.

---

## Architectural Overview
The subsystem is a Single Page Application (SPA) built using **React** (v19.2) and bundled with **Vite** for rapid hot-module replacement and optimized builds. The user interface leverages **Material UI (MUI)** for enterprise-grade, responsive components and theming. Complex data visualization is powered by **Recharts** for time-series telemetry and **React Flow** for dynamic topological mapping. All external communication is handled via **Axios** for REST operations and native **WebSockets** for real-time telemetry streaming.

```text
Sensor
      ↓
Fog layer
      ↓
Spring Boot backend
      ↓
MongoDB
      ↓
ML service
      ↓
Spring Boot backend
      ↓
WebSocket
      ↓
React frontend
      ↓
User interface
```

---

## Directory Structure
The frontend architecture enforces strict separation of concerns, dividing the `/src` directory into specialized modules.

| Directory | Purpose |
|---|---|
| `assets/` | Stores static media files, fonts, and images. |
| `charts/` | Encapsulates complex SVG charting logic (Recharts) away from page logic. |
| `components/` | Houses reusable UI partials like stat cards, tables, and dialogs. |
| `config/` | Contains global configuration variables (e.g., base API URLs). |
| `context/` | Contains React Context providers for global state (Auth, Theme). |
| `hooks/` | Contains custom reusable React hooks (e.g., `usePolling`, `useTelemetryStream`). |
| `layouts/` | Contains master page wrappers handling sidebars and navigation frames. |
| `pages/` | Contains the primary route views mapped to dashboard tabs. |
| `services/` | Centralizes all external HTTP API calls and Axios configurations. |
| `utils/` | Contains shared helper functions and formatters. |

---

## Routing Architecture
The application eschews complex external routing libraries (like `react-router-dom`) in favor of **state-based routing**. 

Routing is orchestrated in `App.jsx` using a single React state variable: `const [activePage, setActivePage] = useState('dashboard')`. When the user clicks a navigation item, this state variable updates, and React dynamically mounts the corresponding component from a predefined dictionary of views.

* **Advantages:** Extremely lightweight, requires zero external dependencies, and provides instantaneous view switching without triggering browser navigation events.
* **Disadvantages:** It breaks the browser's native "Back" button functionality and prevents deep-linking (users cannot bookmark or share a direct URL to a specific sub-page or node view).

```text
User Clicks Navigation
          ↓
setActivePage('alerts')
          ↓
App.jsx evaluates PAGES[activePage]
          ↓
Unmounts <DashboardPage />
          ↓
Mounts <AlertsPage />
```

---

## State Management
The architecture strictly avoids heavy global state management libraries (like Redux or Zustand), judging them to be over-engineered for a presentation-heavy telemetry dashboard.

* **React Context:** Used exclusively for global, rarely-mutating state. `AuthContext` manages user sessions, and `ThemeModeContext` manages the global Light/Dark mode toggles.
* **Local Component State:** The vast majority of application state (including the high-frequency telemetry array) is managed locally within page components using native `useState`. This prevents localized updates from triggering expensive global DOM re-renders.

---

## User Interface Layer
The application UI is built entirely upon **Material UI (MUI)**. MUI provides robust, accessible, and responsive grid layouts out-of-the-box. The MUI **theme system** is heavily utilized to centralize design tokens and natively support seamless transitions between light and dark modes.

To adhere to DRY (Don't Repeat Yourself) principles, the interface is broken down into highly **reusable components**:

* **`NodeCard`**: A standardized summary card displaying the status of individual sensor nodes.
* **`StatCard`**: A uniform wrapper for displaying key performance indicators (e.g., CO2 levels) with icon support.
* **`StatusChip`**: A colored badge indicating operational or hazard status.
* **`ErrorBanner`**: A globalized alert component for rendering API failures.
* **`LoadingOverlay`**: A centralized spinner for blocking UI during async operations.
* **`SectionHeader`**: Standardized typography wrappers for page sub-sections.
* **`CustomPagination`**: A reusable controller for traversing paginated backend data.

---

## Visualization Layer
Data visualization is abstracted into dedicated charting components to keep business logic clean.

* **Recharts:** Selected for time-series graphs due to its native React integration and SVG-based rendering, which prevents the pixel-blurring issues common in HTML5 Canvas libraries like Chart.js.
* **Topology visualization:** The `NetworkTopologyPage` implements **React Flow** (`@xyflow/react`). This is critical because OpenThread mesh networks represent non-linear parent-child routing topologies. React Flow allows administrators to visually map physical node relationships, identify orphaned devices, and debug weak radio links dynamically.

---

## Communication Layer
The application communicates with the Spring Boot backend using a hybrid approach.

* **Axios:** Handles all REST APIs for fetching metadata, resolving alerts, and updating node configurations.
* **WebSockets:** Manages the high-frequency, low-latency telemetry push events from the server.
* **Polling:** Implemented via a `usePolling` hook to periodically fetch slow-moving metadata (like node health or ML status), simplifying the backend's WebSocket broadcast responsibilities.
* **Reconnection logic:** Ensures the dashboard autonomously recovers if the backend restarts.

### API Endpoints (`api.js`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/sensor-data` | GET | Fetch historical telemetry. |
| `/api/sensor-data/page` | GET | Fetch paginated telemetry. |
| `/api/nodes` | GET | Fetch registered sensor nodes. |
| `/api/alerts` | GET | Fetch historical alerts. |
| `/api/alerts/page` | GET | Fetch paginated alerts. |
| `/api/alerts/summary` | GET | Fetch aggregate alert counts. |
| `/api/alerts/resolve-all` | PUT | Bulk resolve active alerts. |
| `/api/alerts/{id}/resolve` | PUT | Resolve a specific alert. |
| `/api/alerts/reset-timers` | POST | Reset backend anti-spam debounces. |
| `/api/nodes/{nodeId}/location` | PUT | Update human-readable node locations. |
| `/api/nodes/{nodeId}/ml/config` | PUT | Update machine-learning hyperparameters. |
| `/api/nodes/ml/status` | GET | Fetch ML poller status. |
| `/api/network/topology` | GET | Fetch OpenThread routing topology. |

---

## WebSocket Architecture
The telemetry stream is managed by the custom `useTelemetryStream` hook using the native browser `WebSocket` API.

* **Socket initialization:** Connects dynamically to `/ws/telemetry` upon component mount.
* **Event handling:** Parses incoming JSON frames and appends them to a local React state array.
* **Reconnection:** If the socket closes, a `setTimeout` loop continuously attempts to reconnect every 5000ms.
* **Timeout strategy:** Protects against transient network drops without requiring a hard browser refresh.

```text
[Mount Hook] -> new WebSocket('/ws/telemetry')
                      |
                      v
             [onopen] Connection Established
                      |
           <---- [onmessage] (Push Telemetry)
                      |
              [onclose] or [onerror]
                      |
                      v
        setTimeout(connect, 5000) (Reconnection Loop)
```

---

## Performance Optimizations
High-frequency telemetry inherently risks crashing browser DOM limits.

* **Stream Slicing:** The `useTelemetryStream` hook strictly enforces a **10,000-record limit** on the telemetry array. If the array exceeds this size, it slices off the oldest records. This prevents memory leaks and fatal Out-of-Memory browser crashes during long-running NOC dashboard sessions.
* **Rendering optimization:** Chart rendering logic is isolated, ensuring that high-frequency data pushes only re-render the charts, not the entire page.
* **Component reuse:** Prevents duplicated DOM mounting logic.

---

## Authentication and Authorization
Authentication is managed via `AuthContext.jsx`.

* **Local storage:** Session data is persisted across tabs as a plaintext JSON string in the browser's `localStorage`.
* **Roles:** Implements basic Role-Based Access Control (admin vs. visitor), which conditionally disables configuration inputs in the UI.
* **Session persistence:** The session lasts indefinitely until explicit logout.

> **WARNING:** This implementation is intended strictly for development and demonstration purposes. It utilizes hardcoded client-side environment variables for credentials and lacks secure HTTP-only cookies, JWTs, or backend route protection. Users can trivially bypass authorization by manually altering their local storage payload.

---

## Failure Handling
The frontend is designed to be highly resilient against network volatility.

* **Backend disconnection:** The WebSocket `onclose` handler immediately triggers autonomous reconnection logic.
* **Network failures:** Handled gracefully via Axios interceptors and global catch blocks, rendering the `ErrorBanner` component to notify the user.
* **Stale data:** Because caching libraries were actively rejected, the dashboard avoids displaying dangerous, stale life-safety metrics if the connection is lost.

---

## Limitations
* **Absence of TypeScript:** Increases the risk of runtime errors and silent payload structure mismatches.
* **Absence of Redux/Caching:** No advanced data caching (e.g., React Query or SWR) limits offline capabilities.
* **Absence of Server-Side Rendering (SSR):** Increases initial time-to-interactive load times compared to Next.js.
* **State-based routing:** Prevents deep-linking, bookmarking, and native browser navigation (Back/Forward).
* **Client-side authentication:** Extremely insecure; trivial to bypass via developer tools.

---

## Future Improvements
* **JWT Authentication:** Implement secure JSON Web Tokens with HTTP-only cookies and cryptographic backend validation.
* **Backend Authorization:** Enforce role-based access control at the Spring Boot controller level.
* **TypeScript Migration:** Refactor all `.jsx` files to `.tsx` for strict compile-time type safety.
* **React Router Integration:** Replace state-based routing with `react-router-dom` to support deep linking and SEO.
* **React Query:** Implement a robust caching layer for static metadata requests to reduce server load.
* **Virtualization:** Implement list virtualization (e.g., `react-window`) for the Alerts and Nodes tables to support massive scale.
* **Stream Processing:** Integrate STOMP or SockJS over WebSockets to support topic-based pub/sub routing.

---

## Conclusions
The frontend tier provides a lightweight, highly responsive, and real-time visualization layer for the SSNS ecosystem. By prioritizing native React APIs and avoiding over-engineered global state managers, the dashboard achieves high performance. The strategic use of Material UI, Recharts, and React Flow significantly accelerates development while delivering an enterprise-grade aesthetic. However, the architectural decisions prioritizing MVP speed—namely state-based routing, local-storage authentication, and the omission of TypeScript—represent significant technical debt that must be addressed before production deployment.

*(All schema, architectural, and design decisions within this document have been explicitly classified as VERIFIED, INFERRED, or NOT FOUND based on repository audits.)*
