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
export const fetchSensorData = async (nodeId) => {
  const params = nodeId ? { nodeId } : {};
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

/** Fetch paginated alerts with optional filters. */
export const fetchAlertsPage = async (unresolvedOnly = false, types = [], page = 0, size = 10) => {
  const params = new URLSearchParams();
  params.append('unresolvedOnly', unresolvedOnly);
  params.append('page', page);
  params.append('size', size);
  if (types && types.length > 0) {
    types.forEach(type => params.append('types', type));
  }
  const { data } = await client.get('/api/alerts/page', { params });
  return data;
};

/** Mark all unresolved alerts as resolved, optionally filtered by types. */
export const resolveAllAlerts = async (types = []) => {
  const params = new URLSearchParams();
  if (types && types.length > 0) {
    types.forEach(type => params.append('types', type));
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

export default { fetchSensorData, fetchSensorDataPage, fetchNodes, fetchAlerts, fetchAlertsPage, resolveAllAlerts, resolveAlert, updateNodeLocation };
