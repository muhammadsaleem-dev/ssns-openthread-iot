import { useState, useEffect } from 'react';
import { Box, Card, Typography, Select, MenuItem, FormControl, InputLabel, CircularProgress, useTheme } from '@mui/material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import usePolling from '../hooks/usePolling';
import { fetchNodes } from '../services/api';
import API from '../config/api';
import SectionHeader from '../components/SectionHeader';
import ErrorBanner from '../components/ErrorBanner';

export default function NodeMetricsPage() {
  const theme = useTheme();
  const { data: nodes, error: nodesError } = usePolling(fetchNodes, API.POLL_INTERVAL);
  const [selectedNode, setSelectedNode] = useState('');
  
  const [telemetry, setTelemetry] = useState([]);
  const [linkQuality, setLinkQuality] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (nodes && nodes.length > 0 && !selectedNode) {
      setSelectedNode(nodes[0].nodeId);
    }
  }, [nodes, selectedNode]);

  useEffect(() => {
    if (!selectedNode) return;
    
    setLoading(true);
    
    // Fetch telemetry
    const fetchTelemetry = fetch(`${API.BASE_URL}/api/sensor-data?nodeId=${selectedNode}&hours=24`)
      .then(res => res.json())
      .then(data => {
        return data.reverse().map(d => ({
          ...d,
          time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
      });
      
    // Find meshId for the topology lookup (some nodes have different nodeId and meshId)
    const selectedNodeObj = nodes?.find(n => n.nodeId === selectedNode);
    const topologyId = selectedNodeObj?.meshId || selectedNode;
      
    // Fetch Link Quality
    const fetchLinkQuality = fetch(`${API.BASE_URL}/api/network/topology/node-history/${topologyId}`)
      .then(res => res.json())
      .then(data => {
        return data.map(d => ({
          ...d,
          time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
      });
      
    Promise.all([fetchTelemetry, fetchLinkQuality])
      .then(([telData, lqData]) => {
        setTelemetry(telData);
        setLinkQuality(lqData);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
      
  }, [selectedNode]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ bgcolor: 'background.paper', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, mb: 1, display: 'block' }}>{label}</Typography>
          {payload.map((entry, index) => (
            <Typography key={index} variant="body2" sx={{ color: entry.color, fontSize: '0.75rem' }}>
              {entry.name}: {entry.value != null ? entry.value.toFixed(2) : 'N/A'}
            </Typography>
          ))}
        </Box>
      );
    }
    return null;
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <SectionHeader title="Node Metrics" subtitle="Deep telemetry and signal quality analysis over time" />
      
      {nodesError && <ErrorBanner />}

      <Box sx={{ mb: 4, mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl sx={{ minWidth: 240 }} size="small">
          <InputLabel id="node-select-label">Select Node</InputLabel>
          <Select
            labelId="node-select-label"
            value={selectedNode}
            label="Select Node"
            onChange={(e) => setSelectedNode(e.target.value)}
          >
            {nodes?.map(node => (
              <MenuItem key={node.nodeId} value={node.nodeId}>
                {node.location || node.nodeId} ({node.nodeId})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {loading && <CircularProgress size={24} />}
      </Box>

      {/* Charts Grid */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Environmental Data */}
        <Card sx={{ p: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>Temperature & Humidity (24h)</Typography>
          <Box sx={{ width: '100%', height: 300 }}>
            {telemetry.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={telemetry} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke={theme.palette.primary.main} fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke={theme.palette.secondary.main} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="temperature" name="Temp (°C)" stroke={theme.palette.primary.main} dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity (%)" stroke={theme.palette.secondary.main} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">No telemetry data available</Typography>
              </Box>
            )}
          </Box>
        </Card>

        {/* Air Quality Data */}
        <Card sx={{ p: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>Air Quality: PM2.5 & CO2 (24h)</Typography>
          <Box sx={{ width: '100%', height: 300 }}>
            {telemetry.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={telemetry} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={12} tickMargin={10} />
                  <YAxis yAxisId="left" stroke={theme.palette.error.main} fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke={theme.palette.warning.main} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="pm2_5" name="PM2.5 (µg/m³)" stroke={theme.palette.error.main} dot={false} strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke={theme.palette.warning.main} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">No air quality data available</Typography>
              </Box>
            )}
          </Box>
        </Card>

        {/* Signal Quality Data */}
        <Card sx={{ p: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 700 }}>Network Link Quality (LQI)</Typography>
          <Box sx={{ width: '100%', height: 300 }}>
            {linkQuality.length > 0 ? (
              <ResponsiveContainer>
                <LineChart data={linkQuality} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="time" stroke={theme.palette.text.secondary} fontSize={12} tickMargin={10} />
                  <YAxis domain={[0, 100]} stroke={theme.palette.info.main} fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="stepAfter" dataKey="linkQualityIn" name="Link Quality In" stroke={theme.palette.info.main} dot={false} strokeWidth={2} />
                  <Line type="stepAfter" dataKey="linkQualityOut" name="Link Quality Out" stroke={theme.palette.success.main} dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography variant="body2" color="text.secondary">No historical routing data available</Typography>
              </Box>
            )}
          </Box>
        </Card>

      </Box>
    </Box>
  );
}
