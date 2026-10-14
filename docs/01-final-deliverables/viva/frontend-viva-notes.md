# Frontend Viva Notes

---

## 1. Purpose of the Frontend

**Q: What is the purpose of the frontend?**
A: It serves as the primary visual interface for the Smart Monitoring platform, allowing operators to view real-time telemetry, manage sensor nodes, configure machine-learning parameters, and analyze alerts.

**Q: Why was a web dashboard required?**
A: Raw JSON streams from IoT gateways and backends are not actionable for human administrators. A dashboard translates high-frequency data into visual trends, spatial topologies, and centralized alerts.

**Q: How does the frontend interact with the backend?**
A: It uses a hybrid communication approach: Axios handles standard REST HTTP requests (for configurations and metadata), while native WebSockets handle the high-speed, continuous push of life-safety telemetry streams.

---

## 2. Technology Stack

### React
* **Purpose:** Core UI library for building the Single Page Application (SPA).
* **Advantages:** High rendering performance via the Virtual DOM, massive ecosystem, component-driven architecture.
* **Disadvantages:** Only a view library; requires third-party packages for routing, global state, and data fetching.
* **Alternatives:** Vue.js, Angular, Svelte.

### Vite
* **Purpose:** Build tool and local development server.
* **Advantages:** Near-instantaneous Hot Module Replacement (HMR) and optimized Rollup builds. Vastly faster than Webpack.
* **Disadvantages:** Relatively newer ecosystem compared to Webpack.
* **Alternatives:** Create-React-App (Webpack), Parcel.

### Material UI (MUI)
* **Purpose:** Enterprise-grade UI component library and styling system.
* **Advantages:** Provides highly accessible, pre-built components (Tables, Dialogs) and a native theming engine (Light/Dark mode).
* **Disadvantages:** Large bundle size; overriding default styles can be complex.
* **Alternatives:** Tailwind CSS, Bootstrap, Chakra UI.

### Recharts
* **Purpose:** Renders dynamic time-series telemetry charts.
* **Advantages:** Native to React, highly declarative, binds easily to React state arrays. SVG-based rendering prevents pixel-blurring.
* **Disadvantages:** Less performant than Canvas-based renderers when drawing millions of points.
* **Alternatives:** Chart.js, Highcharts, D3.js.

### React Flow
* **Purpose:** Renders the dynamic OpenThread mesh network topology.
* **Advantages:** Best-in-class for interactive, non-linear node-and-edge graphs. Supports drag-and-drop spatial layouts.
* **Disadvantages:** Steep learning curve for complex edge routing logic.
* **Alternatives:** D3.js, Cytoscape.js.

### Axios
* **Purpose:** HTTP client for REST API communication.
* **Advantages:** Automatic JSON transformation, built-in timeout handling, and powerful request/response interceptors.
* **Disadvantages:** Adds a minor dependency size overhead compared to native `fetch`.
* **Alternatives:** Native Browser `fetch()`.

### WebSockets
* **Purpose:** Maintains a persistent connection for real-time telemetry pushes.
* **Advantages:** Avoids the massive HTTP handshake overhead of polling 1Hz data; provides immediate push updates.
* **Disadvantages:** Connections can drop silently; requires manual reconnection logic and state management.
* **Alternatives:** Server-Sent Events (SSE), HTTP Long Polling.

---

## 3. Routing

**Q: Why was state-based routing selected?**
A: `useState('dashboard')` allows instant switching of page components. It is extremely fast to implement for an MVP and requires zero external dependencies.

**Q: Why was react-router-dom not selected?**
A: The dashboard is an internal tool functioning as a single workspace. Deep-linking and Search Engine Optimization (SEO) were considered low-priority during the MVP phase.

**Q: What are the advantages?**
A: Zero boilerplate, no external dependencies, instantaneous view transitions without browser navigation events.

**Q: What are the disadvantages?**
A: Breaks the browser's native "Back" button functionality and prevents users from bookmarking or sharing a direct URL to a specific sub-page.

**Example:**
```javascript
const [activePage, setActivePage] = useState('dashboard');
const PageComponent = PAGES[activePage];
return <PageComponent />;
```

---

## 4. State Management

**Q: Why was Redux not selected?**
A: Redux introduces massive boilerplate (actions, reducers, stores) that was deemed over-engineered for an application that primarily just displays raw backend streams.

**Q: Why was Zustand not selected?**
A: While lighter than Redux, the state requirements (Theme, Auth, Telemetry) were simple enough that an external state library was not required at all.

**Q: Why was React Context selected?**
A: Perfect for global state that rarely mutates, preventing prop-drilling for variables like Light/Dark mode and User Auth sessions.

**Q: Why was `useState` selected?**
A: High-frequency telemetry arrays and UI toggles (e.g., opening a drawer) are localized to specific pages. Keeping them in local `useState` prevents expensive global DOM re-renders.

---

## 5. User Interface Design

* **Reusable components:** Elements like `StatCard.jsx` and `NodeCard.jsx` encapsulate rendering logic, allowing the same visual structures to be reused across Dashboard and Node pages, keeping code DRY.
* **Responsive design:** Utilizing MUI's Grid and Stack components ensures the dashboard does not break when viewed on different screen sizes (NOC monitors vs. field technician tablets).
* **Themes:** The MUI theme system centralizes design tokens (colors, typography), ensuring global visual consistency.
* **Dark mode:** Natively supported by MUI Context; vital for reducing eye strain for network administrators staring at NOC screens for hours.
* **Accessibility:** MUI components handle ARIA labels, focus trapping, and keyboard navigation automatically out-of-the-box.

---

## 6. Visualization Layer

**Q: Why was Recharts selected?**
A: It relies on SVG instead of Canvas, meaning lines remain razor-sharp on high-DPI screens. It also uses declarative React components (`<LineChart />`) that bind effortlessly to the telemetry array.

**Q: Why was React Flow selected?**
A: Standard charts cannot visualize non-linear parent-child routing topologies. React Flow allows interactive, spatial mapping of the OpenThread mesh network.

**Q: How are telemetry data visualized?**
A: Using multi-line time-series graphs separated by physical metrics (CO2, Temperature) plotting historical values against continuous time axes.

**Q: How is network topology visualized?**
A: Nodes are represented as interactive cards, and routing links are drawn as SVG bezier curves connecting parent routers to child endpoints, providing immediate visual feedback on orphaned nodes.

---

## 7. Communication Layer

* **REST communication:** Used for metadata, configurations, resolving alerts, and user interactions. Handled via Axios.
* **Axios:** Centralizes API config (Base URL, Timeouts) in a single `api.js` service file.
* **Polling:** The custom `usePolling` hook is used for slow-moving data (like ML status) that does not require the heavy infrastructure of real-time pushes.
* **WebSockets:** Subscribes strictly to `/ws/telemetry` for high-frequency pushes.
* **Reconnection logic:** The `useTelemetryStream` hook implements a `setTimeout` loop that automatically attempts to reconnect every 5000ms if the connection drops.

**Complete Data Flow:**
```text
Sensor
      ↓
Fog layer
      ↓
Backend
      ↓
Database
      ↓
ML service
      ↓
Backend
      ↓
WebSocket
      ↓
Frontend
```

---

## 8. Authentication

**Q: How does authentication work?**
A: It evaluates hardcoded client-side environment variables (`VITE_ADMIN_USER`, `VITE_VISITOR_USER`) against user input directly in the browser during login.

**Q: How are roles stored?**
A: As a plaintext JSON object containing a `role` property (`admin` vs `visitor`).

**Q: How are sessions managed?**
A: The plaintext JSON object is persisted in the browser's `localStorage` (`ssns_auth_user`). The session lasts indefinitely until the user clicks Logout.

**Q: Why is this approach insecure?**
A: There is no cryptographic validation. Any user can open Chrome DevTools, edit their `localStorage` payload to `{ "role": "admin" }`, and bypass the frontend UI restrictions, as the backend lacks corresponding route authorization.

---

## 9. Performance Optimizations

* **Stream slicing:** Arrays grow infinitely during a session. Slicing prevents Out-of-Memory browser crashes.
* **The 10,000-record limit:** Enforced natively in the WebSocket hook (`updated.slice(updated.length - 10000)`). It balances providing a long historical chart view while keeping DOM rendering within safe performance thresholds.
* **Responsive rendering:** Chart sub-components are isolated so that the 1Hz telemetry updates only re-render the SVG graph, not the surrounding sidebars or navigation headers.
* **Component reuse:** Avoids duplicating expensive mounting logic for similar data structures.

---

## 10. Common Professor Questions

**1. Why did you select React?**
A: The Virtual DOM provides excellent performance for rapidly updating 1Hz UI elements, and the component architecture enforces strict code organization.

**2. Why did you select Material UI?**
A: To dramatically accelerate MVP development. Building complex, accessible tables, dialogs, and responsive grids from scratch using raw CSS would have wasted critical engineering time.

**3. Why did you select WebSockets?**
A: To support real-time life-safety telemetry without overwhelming the backend with continuous HTTP polling handshakes.

**4. Why did you avoid Redux?**
A: It introduces unnecessary boilerplate (actions, reducers) for an application that primarily acts as a read-only presentation layer.

**5. Why did you avoid TypeScript?**
A: To prioritize rapid prototyping. Writing strict type interfaces before the backend API contract was finalized would have slowed down early iterations.

**6. Why did you implement polling?**
A: For slow-moving metadata (like node health). It is simpler to pull this via HTTP every few seconds than to build complex topic routing into the WebSocket payload.

**7. Why did you use React Flow?**
A: OpenThread networks are dynamic mesh topologies. Standard tabular data cannot easily convey routing parent-child relationships or visualize orphaned nodes. 

**8. Why did you avoid React Router?**
A: The dashboard is an internal tool functioning as a single workspace. Deep-linking and SEO were considered low-priority during the MVP phase.

**9. Why are JWTs missing?**
A: Security was deprioritized in the MVP to focus on end-to-end data throughput and ML integration. Currently, authentication relies on insecure client-side environment variables.

**10. What would you improve in the future?**
A: Implement JWT authentication, migrate the codebase to TypeScript, and add React Router for URL persistence.

**11. Why did you slice the WebSocket array?**
A: At 1Hz, the system receives 3,600 objects an hour. Without slicing, the React state array grows infinitely, eventually crashing the browser tab.

**12. Why wasn't caching (like React Query) used?**
A: In an environmental safety monitoring application, displaying stale data is dangerous. We prioritize fetching fresh data over serving cached offline responses.

**13. How does the frontend handle backend crashes?**
A: The WebSocket `onclose` event triggers a `setTimeout` loop that autonomously attempts to reconnect every 5 seconds until the server recovers.

**14. What are the disadvantages of state-based routing?**
A: It breaks the browser's Back button and prevents users from sharing direct URL links to specific dashboard views.

**15. Why use Axios instead of native `fetch`?**
A: Axios automatically stringifies/parses JSON payloads and provides a powerful interceptor architecture for future token injection.

**16. Why is Recharts better than Chart.js for this project?**
A: Recharts generates SVG elements natively bound to React. Chart.js draws on a Canvas, which can become blurry on high-DPI displays and is harder to style with CSS.

**17. How does the frontend handle different roles?**
A: The `AuthContext` provides an `isAdmin` boolean. If false, UI elements like configuration forms and Reset buttons are conditionally disabled or hidden.

**18. Why do the charts sometimes appear crowded?**
A: Recharts attempts to render all 10,000 points. A future improvement would involve data decimation or list virtualization to aggregate points at wide zoom levels.

**19. Why does the API base URL fallback to window.location.host?**
A: If the app is built for production and served directly by the backend (or Nginx proxy), it assumes the API and WebSocket server are hosted on the exact same domain.

**20. What is the single biggest technical debt in the frontend?**
A: The client-side authentication mechanism. It provides a false sense of security and relies on a backend that does not currently authorize incoming REST requests.

---

## 11. Limitations

* **Client-side authentication:** Provides zero real security. Bypassing the frontend exposes the unprotected backend APIs.
* **Absence of JWTs:** No cryptographic validation of the user's identity or session duration.
* **Absence of server-side rendering:** Increases the initial time-to-interactive load times because the browser must download and execute the entire JavaScript bundle before rendering the UI.
* **Absence of TypeScript:** Increases the risk of runtime errors, particularly if the backend slightly changes a JSON payload structure.
* **Absence of advanced caching:** Offline support is non-existent.

---

## 12. Future Work

* **JWT authentication:** Implement secure, cryptographically signed JSON Web Tokens for identity verification.
* **Backend authorization:** Enforce Role-Based Access Control (RBAC) at the Spring Boot controller level.
* **TypeScript migration:** Refactor all `.jsx` files to `.tsx` for strict compile-time type safety and better IDE intellisense.
* **React Router integration:** Replace state-based routing with `react-router-dom` to support deep linking, bookmarks, and browser history navigation.
* **React Query:** Implement a robust caching layer for static metadata requests to reduce unnecessary server load.
* **Virtualization:** Implement list virtualization (e.g., `react-window`) for the Alerts and Nodes tables to support massive scale without DOM lag.
