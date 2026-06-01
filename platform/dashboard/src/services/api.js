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

/** Update the human-readable location of a specific node. */
export const updateNodeLocation = async (nodeId, location) => {
  const { data } = await client.put(`/api/nodes/${nodeId}/location`, { location });
  return data;
};

export default { fetchSensorData, fetchNodes, fetchAlerts, updateNodeLocation };
