/**
 * API service layer — single point of contact for all backend communication.
 */

import axios from 'axios';
import API from '../config/api';

const client = axios.create({
  baseURL: API.BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/** Fetch all sensor telemetry (optionally filtered by nodeId). */
export const fetchSensorData = async (nodeId, hours = 1) => {
  const params = { hours };
  if (nodeId) params.nodeId = nodeId;
  const { data } = await client.get('/api/sensor-data', { params });
  return data;
};

/** Fetch paginated sensor telemetry. */
export const fetchSensorDataPage = async (nodeId, page = 0, size = 10) => {
  const params = { page, size };
  if (nodeId) params.nodeId = nodeId;
  const { data } = await client.get('/api/sensor-data/page', { params });
  return data;
};

/** Fetch all registered sensor nodes. */
export const fetchNodes = async () => {
  const { data } = await client.get('/api/nodes');
  return data;
};

/** Fetch all alerts. */
export const fetchAlerts = async () => {
  const { data } = await client.get('/api/alerts');
  return data;
};

/** Fetch paginated alerts with optional category filter and nodeId. */
export const fetchAlertsPage = async (unresolvedOnly = false, category = 'all', page = 0, size = 10, nodeId = null) => {
  const params = { unresolvedOnly, page, size };
  if (category && category !== 'all') {
    params.category = category;
  }
  if (nodeId) {
    params.nodeId = nodeId;
  }
  const { data } = await client.get('/api/alerts/page', { params });
  return data;
};

/** Fetch summary counts of alerts by category, optionally filtered by nodeId. */
export const fetchAlertCounts = async (nodeId = null) => {
  const params = {};
  if (nodeId) params.nodeId = nodeId;
  const { data } = await client.get('/api/alerts/summary', { params });
  return data;
};

export const resolveAllAlerts = async (category = 'all') => {
  const params = {};
  if (category && category !== 'all') {
    params.category = category;
  }
  const { data } = await client.put('/api/alerts/resolve-all', null, { params });
  return data;
};

/** Mark a single alert as resolved. */
export const resolveAlert = async (id) => {
  const { data } = await client.put(`/api/alerts/${id}/resolve`);
  return data;
};

/** Update the human-readable location of a specific node. */
export const updateNodeLocation = async (nodeId, location) => {
  const { data } = await client.put(`/api/nodes/${nodeId}/location`, { location });
  return data;
};

/** Update ML configuration for a node. */
export const updateMlConfig = async (nodeId, mlEnabled, baselineWindowSize, sensitivity, forecastHorizonMin, forceReset = false) => {
  const { data } = await client.put(`/api/nodes/${nodeId}/ml/config`, {
    mlEnabled,
    baselineWindowSize,
    sensitivity,
    forecastHorizonMin
  }, {
    params: { forceReset }
  });
  return data;
};

/** Fetch ML Service status. */
export const fetchMlStatus = async () => {
  const { data } = await client.get('/api/nodes/ml/status');
  return data;
};

/** Fetch the latest OpenThread Network Topology */
export const fetchNetworkTopology = async () => {
  const { data } = await client.get('/api/network/topology');
  return data;
};

export default { fetchSensorData, fetchSensorDataPage, fetchNodes, fetchAlerts, fetchAlertCounts, fetchAlertsPage, resolveAllAlerts, resolveAlert, updateNodeLocation, updateMlConfig, fetchMlStatus, fetchNetworkTopology };
