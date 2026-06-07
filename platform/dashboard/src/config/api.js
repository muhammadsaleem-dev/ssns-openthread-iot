/**
 * API configuration for the BLE Smart Monitoring Dashboard.
 *
 * Centralises backend URL and endpoint definitions.
 * All API calls reference these constants to ensure consistency.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || '';

const API = {
  BASE_URL: API_BASE_URL,
  ENDPOINTS: {
    SENSOR_DATA: `${API_BASE_URL}/api/sensor-data`,
    NODES: `${API_BASE_URL}/api/nodes`,
    ALERTS: `${API_BASE_URL}/api/alerts`,
  },
  /** Polling interval in milliseconds */
  POLL_INTERVAL: Number(import.meta.env.VITE_POLL_INTERVAL) || 10000,
};

export default API;
