/**
 * DashboardPage — primary monitoring overview.
 *
 * Displays KPI summary cards, real-time telemetry charts,
 * a recent telemetry feed, and a live alerts panel.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';
import { Box, Grid, Card, CardContent, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, alpha, Select, MenuItem, FormControl, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, TablePagination, ToggleButtonGroup, ToggleButton, useTheme } from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AirIcon from '@mui/icons-material/Air';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EditIcon from '@mui/icons-material/Edit';
import HubIcon from '@mui/icons-material/Hub';

import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import ErrorBanner from '../components/ErrorBanner';
import TelemetryChart from '../charts/TelemetryChart';
import usePolling from '../hooks/usePolling';
import useTelemetryStream from '../hooks/useTelemetryStream';
import { fetchSensorData, fetchSensorDataPage, fetchNodes, fetchAlertsPage, fetchAlertCounts, updateNodeLocation, fetchNetworkTopology } from '../services/api';
import { formatTimestamp, average, computeAqi } from '../utils/format';
import CustomPagination from '../components/CustomPagination';
import ActivityFeed from '../components/alerts/ActivityFeed';
import API from '../config/api';

const SEVERITY_COLOR = {
  CRITICAL: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState(1);
  const fetchSensorDataFn = useCallback(() => fetchSensorData(null, timeRange), [timeRange]);
  
  // Fetch historical data ONCE on mount or when timeRange changes (interval = null disables polling)
  const { data: initialSensorData, loading: loadingSensor, error: errorSensor } = usePolling(fetchSensorDataFn, null);
  const { streamData: sensorData, initStreamData } = useTelemetryStream();

  // Initialize the WebSocket stream with the historical data
  useEffect(() => {
    if (initialSensorData) {
      initStreamData(initialSensorData);
    }
  }, [initialSensorData]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: nodes, loading: loadingNodes, refetch: refetchNodes } = usePolling(fetchNodes, API.POLL_INTERVAL);

  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const fetchRecentAlertsFn = useCallback(() => fetchAlertsPage(false, 'all', 0, 5, selectedNodeId), [selectedNodeId]);
  const fetchCountsFn = useCallback(() => fetchAlertCounts(selectedNodeId), [selectedNodeId]);

  const { data: recentAlertsPage, loading: loadingAlerts } = usePolling(fetchRecentAlertsFn, API.POLL_INTERVAL);
  const { data: alertCounts } = usePolling(fetchCountsFn, API.POLL_INTERVAL);
  const { data: topologyData } = usePolling(fetchNetworkTopology, API.POLL_INTERVAL);
  
  // State for renaming a node
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Pagination State for the Table
  const [tablePage, setTablePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(10);

  // Intelligent polling for the paginated table
  const fetchPaginatedFn = useCallback(
    () => fetchSensorDataPage(selectedNodeId, tablePage, tableRowsPerPage),
    [selectedNodeId, tablePage, tableRowsPerPage]
  );
  // Auto-refresh only if on the very first page
  const { data: pageData, loading: loadingPage } = usePolling(fetchPaginatedFn, tablePage === 0 ? API.POLL_INTERVAL : null);

  const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];

  // --- Derived metrics ---
  // Group telemetry by nodeId to find the latest reading per node
  const latestTelemetryByNode = useMemo(() => {
    if (!sensorData) return {};
    const latest = {};
    const sorted = [...sensorData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sorted.forEach(d => {
      latest[d.nodeId] = d;
    });
    return latest;
  }, [sensorData]);

  // Helper to resolve human-readable name
  const getNodeName = (nodeId) => {
    if (!nodes) return nodeId;
    const node = nodes.find(n => n.nodeId === nodeId);
    return node && node.location ? node.location : nodeId;
  };

  const selectedNode = selectedNodeId ? nodes?.find(n => n.nodeId === selectedNodeId) : null;
  const selectedLocationName = selectedNodeId ? getNodeName(selectedNodeId) : null;

  const handleSaveName = async () => {
    if (!selectedNodeId) return;
    setIsUpdatingName(true);
    try {
      await updateNodeLocation(selectedNodeId, editNameValue.trim());
      await refetchNodes();
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update location:", error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  // --- Filtering Logic ---
  const filteredSensorData = useMemo(() => {
    if (!sensorData) return [];
    if (!selectedNodeId) return sensorData;
    return sensorData.filter(d => d.nodeId === selectedNodeId);
  }, [sensorData, selectedNodeId]);

  // Sort telemetry chronologically for charts (up to last 50 records)
  // Maps data to support multi-line rendering
  const chartData = useMemo(() => {
    if (!filteredSensorData) return [];
    
    // Group telemetry into 10-second buckets so Recharts combines them in the same tooltip
    const grouped = {};
    
    const sortedData = [...filteredSensorData]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    sortedData.forEach(d => {
      const date = new Date(d.timestamp);
      const coeff = 1000 * 10; // Round to nearest 10 seconds
      const roundedDate = new Date(Math.round(date.getTime() / coeff) * coeff);
      const key = roundedDate.toISOString();
      
      if (!grouped[key]) {
        grouped[key] = { timestamp: roundedDate.getTime() };
      }
      
      // Node-specific keys for multi-line LineCharts (excluding hardware faults <= -900)
      if (d.temperature > -900) grouped[key][`${d.nodeId}_temperature`] = d.temperature;
      if (d.co2 > -900) grouped[key][`${d.nodeId}_co2`] = d.co2;
      if (d.pm2_5 > -900) grouped[key][`${d.nodeId}_pm2_5`] = d.pm2_5;
      
      // Fallback generic keys for single-node AreaCharts
      if (d.temperature > -900) grouped[key]['temperature'] = d.temperature;
      if (d.co2 > -900) grouped[key]['co2'] = d.co2;
      if (d.pm2_5 > -900) grouped[key]['pm2_5'] = d.pm2_5;
    });

    return Object.values(grouped).sort((a, b) => a.timestamp - b.timestamp);
  }, [filteredSensorData]);

  const buildSeries = (dataKey) => {
    if (selectedNodeId || !nodes) return null;
    return nodes.map((n, i) => ({
      key: `${n.nodeId}_${dataKey}`,
      name: n.location || n.nodeId,
      color: CHART_COLORS[i % CHART_COLORS.length]
    }));
  };

  // Recent feed is now populated directly from the paginated endpoint
  const recentFeed = useMemo(() => {
    if (!pageData || !pageData.content) return [];
    return pageData.content;
  }, [pageData]);

  // Recent alerts (latest 5)
  const recentAlerts = useMemo(() => {
    if (!recentAlertsPage || !recentAlertsPage.content) return [];
    return recentAlertsPage.content.filter(a => a.severity !== 'INFO');
  }, [recentAlertsPage]);

  // Smart KPI Stats (Max for global, Exact for specific room)
  const stats = useMemo(() => {
    let targetTelemetries = [];
    if (selectedNodeId) {
       const nodeData = latestTelemetryByNode[selectedNodeId];
       if (nodeData) targetTelemetries.push(nodeData);
    } else {
       targetTelemetries = Object.values(latestTelemetryByNode);
    }

    const getMaxValueAndLocation = (key) => {
      let maxVal = -Infinity;
      let maxNodeId = null;
      targetTelemetries.forEach(d => {
        let val = d[key];
        if (key === 'aqi') val = computeAqi(d.pm2_5, d.pm10);
        if (val != null && !isNaN(val) && val > maxVal) {
          maxVal = val;
          maxNodeId = d.nodeId;
        }
      });
      return { val: maxVal === -Infinity ? null : maxVal, nodeId: maxNodeId };
    };

    const tempMax = getMaxValueAndLocation('temperature');
    const co2Max = getMaxValueAndLocation('co2');
    const pm25Max = getMaxValueAndLocation('pm2_5');
    const aqiMax = getMaxValueAndLocation('aqi');

    const formatTrend = (maxNodeId) => {
      if (selectedNodeId) return selectedLocationName;
      if (!maxNodeId) return "Across facility";
      return `in ${getNodeName(maxNodeId)}`;
    };

    return {
      temp: tempMax.val != null ? tempMax.val.toFixed(1) : '--',
      tempTrend: formatTrend(tempMax.nodeId),
      co2: co2Max.val != null ? Math.round(co2Max.val) : '--',
      co2Trend: formatTrend(co2Max.nodeId),
      pm25: pm25Max.val != null ? pm25Max.val.toFixed(1) : '--',
      pm25Trend: formatTrend(pm25Max.nodeId),
      aqi: aqiMax.val != null ? Math.round(aqiMax.val) : '--',
      aqiTrend: formatTrend(aqiMax.nodeId),
      nodeCount: nodes ? nodes.filter(n => n.status === 'ONLINE').length : 0,
      alertCount: alertCounts ? alertCounts.all : 0,
    };
  }, [latestTelemetryByNode, nodes, alertCounts, selectedNodeId, selectedLocationName]);

  if (loadingSensor && !sensorData) return <LoadingOverlay message="Connecting to backend..." />;

  return (
    <Box sx={{ p: { xs: 3, md: 4 } }}>
      {/* Page header */}
      <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>
            Environmental Monitoring
          </Typography>
          <Typography variant="subtitle1">
            Real-time Thread sensor telemetry overview
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', md: 'auto' } }}>
          <StatCard
            title="Border Router"
            value={topologyData?.gatewayHealth?.status?.toUpperCase() || 'OFFLINE'}
            icon={<HubIcon />}
            trend={topologyData?.gatewayHealth?.channel ? `PAN ID: ${topologyData.gatewayHealth.panId} • Ch ${topologyData.gatewayHealth.channel}` : `PAN ID: ${topologyData?.gatewayHealth?.panId || '---'}`}
            color={topologyData?.gatewayHealth?.status === 'active' ? '#10B981' : '#EF4444'}
          />
          <FormControl sx={{ flexGrow: 1, minWidth: { md: 200 } }}>
            <Select 
              size="small"
              value={selectedNodeId || ''} 
              onChange={e => setSelectedNodeId(e.target.value || null)} 
              displayEmpty
              sx={{ bgcolor: 'background.paper' }}
            >
              <MenuItem value=""><em>All Rooms (Building Overview)</em></MenuItem>
              {nodes?.map(n => (
                <MenuItem key={n.nodeId} value={n.nodeId}>{n.location || n.nodeId}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedNodeId && (
            <IconButton 
              size="small" 
              onClick={() => {
                setEditNameValue(selectedLocationName || '');
                setIsEditingName(true);
              }}
              sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {errorSensor && <ErrorBanner message="Unable to reach backend API. Retrying..." />}
      {/* ─── KPI Summary Cards ─── */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title={selectedNodeId ? "Temperature" : "Highest Temp"}
            value={stats.temp}
            unit="°C"
            icon={<ThermostatIcon fontSize="small" />}
            color={stats.temp > 28 ? '#EF4444' : '#3B82F6'}
            trend={stats.tempTrend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title={selectedNodeId ? "CO2 Level" : "Highest CO2"}
            value={stats.co2}
            unit="ppm"
            icon={<AirIcon fontSize="small" />}
            color={stats.co2 > 1000 ? '#EF4444' : '#10B981'}
            trend={stats.co2Trend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title={selectedNodeId ? "PM2.5" : "Highest PM2.5"}
            value={stats.pm25}
            unit="µg/m³"
            icon={<CloudOutlinedIcon fontSize="small" />}
            color={stats.pm25 > 35 ? '#EF4444' : '#F59E0B'}
            trend={stats.pm25Trend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title={selectedNodeId ? "AQI" : "Highest AQI"}
            value={stats.aqi}
            unit="Index"
            icon={<CloudOutlinedIcon fontSize="small" />}
            color={stats.aqi > 100 ? '#EF4444' : '#8B5CF6'}
            trend={stats.aqiTrend}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Active Nodes"
            value={selectedNodeId ? (selectedNode?.status === 'ONLINE' ? 1 : 0) : stats.nodeCount}
            icon={<SensorsIcon fontSize="small" />}
            color={selectedNodeId ? (selectedNode?.status === 'ONLINE' ? '#10B981' : '#EF4444') : '#8B5CF6'}
            trend={selectedNodeId ? (selectedNode?.status === 'ONLINE' ? 'Online' : 'Offline') : `${nodes ? nodes.length : 0} registered`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}>
          <StatCard
            title="Active Alerts"
            value={stats.alertCount}
            icon={<WarningAmberIcon fontSize="small" />}
            color={stats.alertCount > 0 ? '#EF4444' : '#10B981'}
            trend={selectedNodeId ? selectedLocationName : "Unresolved globally"}
          />
        </Grid>
      </Grid>

      {/* ─── Telemetry Charts ─── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
        <SectionHeader 
          title={selectedLocationName ? `Telemetry Trends: ${selectedLocationName}` : "Telemetry Trends"} 
          subtitle={selectedLocationName ? "Real-time historical trends" : "Recent telemetry across all nodes"} 
        />
        <ToggleButtonGroup
          color="primary"
          value={timeRange}
          exclusive
          onChange={(e, newRange) => { if (newRange !== null) setTimeRange(newRange); }}
          size="small"
        >
          <ToggleButton value={1}>1H</ToggleButton>
          <ToggleButton value={6}>6H</ToggleButton>
          <ToggleButton value={12}>12H</ToggleButton>
          <ToggleButton value={24}>24H</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <TelemetryChart
            title="Temperature (°C)"
            data={chartData}
            dataKey="temperature"
            series={buildSeries('temperature')}
            color="#3B82F6"
            threshold={35}
            minThreshold={10}
            unit="°C"
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <TelemetryChart
            title="CO2 (ppm)"
            data={chartData}
            dataKey="co2"
            series={buildSeries('co2')}
            color="#10B981"
            threshold={1500}
            unit="ppm"
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <TelemetryChart
            title="PM2.5 (µg/m³)"
            data={chartData}
            dataKey="pm2_5"
            series={buildSeries('pm2_5')}
            color="#F59E0B"
            threshold={35}
            unit="µg/m³"
          />
        </Grid>
      </Grid>

      {/* ─── Bottom row: Recent Feed + Alerts + Activity Feed ─── */}
      <Grid container spacing={2.5}>
        {/* Recent Telemetry Feed */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <SectionHeader 
            title={selectedLocationName ? `Recent Telemetry: ${selectedLocationName}` : "Recent Telemetry"} 
            subtitle="Latest sensor readings" 
          />
          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>Node</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>Temp</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>Hum</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>CO2</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>TVOC</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>eCO2</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', sm: 'table-cell' } }}>PM1.0</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>PM2.5</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>PM4.0</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', sm: 'table-cell' } }}>PM10</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem', display: { xs: 'none', lg: 'table-cell' } }}>Light</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.7rem' }}>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentFeed.map((row, i) => {
                    const formatVal = (v, precision = 1) => {
                       if (v == null) return '--';
                       if (v <= -998.5) return <Typography component="span" sx={{ color: 'error.main', fontWeight: 700, fontSize: '0.65rem' }}>FAULT</Typography>;
                       if (v <= -997.5) return <Typography component="span" sx={{ color: 'warning.main', fontWeight: 700, fontSize: '0.65rem' }}>WARMUP</Typography>;
                       return v.toFixed(precision);
                    };

                    return (
                      <TableRow key={row.id || i} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.7rem' }}>{getNodeName(row.nodeId)}</Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{formatVal(row.temperature)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{formatVal(row.humidity)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{formatVal(row.co2, 0)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>{formatVal(row.tvoc, 0)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>{formatVal(row.eco2, 0)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', sm: 'table-cell' } }}>{formatVal(row.pm1_0)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem' }}>{formatVal(row.pm2_5)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', md: 'table-cell' } }}>{formatVal(row.pm4_0)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', sm: 'table-cell' } }}>{formatVal(row.pm10)}</TableCell>
                        <TableCell sx={{ fontSize: '0.7rem', display: { xs: 'none', lg: 'table-cell' } }}>{formatVal(row.lightIntensity, 0)}</TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {formatTimestamp(row.timestamp)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recentFeed.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={12} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No telemetry data yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <CustomPagination
              count={pageData ? pageData.totalElements : 0}
              page={tablePage}
              onPageChange={(e, newPage) => setTablePage(newPage)}
              rowsPerPage={tableRowsPerPage}
              onRowsPerPageChange={(e) => {
                setTableRowsPerPage(parseInt(e.target.value, 10));
                setTablePage(0);
              }}
            />
          </Card>
        </Grid>

        {/* Alerts Panel */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <SectionHeader 
            title={selectedLocationName ? `Recent Alerts: ${selectedLocationName}` : "Recent Alerts"} 
            subtitle="Environmental anomalies" 
          />
          <Card>
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              {recentAlerts.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    No alerts triggered
                  </Typography>
                </Box>
              ) : (
                recentAlerts.map((alert, i) => (
                  <Box
                    key={alert.id || i}
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      borderBottom: i < recentAlerts.length - 1 ? '1px solid' : 'none',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: alpha('#3B82F6', 0.04) },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                      <Chip
                        label={alert.severity}
                        size="small"
                        color={SEVERITY_COLOR[alert.severity] || 'default'}
                        sx={{ height: 22 }}
                      />
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatTimestamp(alert.createdAt)}
                      </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                      {alert.message}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Location: {getNodeName(alert.nodeId)}
                    </Typography>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Activity Feed */}
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <ActivityFeed />
        </Grid>
      </Grid>

      {/* Rename Room Dialog */}
      <Dialog open={isEditingName} onClose={() => !isUpdatingName && setIsEditingName(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Room</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Assign a human-readable name to this sensor node (e.g., "Server Room").
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Room Name"
            value={editNameValue}
            onChange={(e) => setEditNameValue(e.target.value)}
            disabled={isUpdatingName}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditingName(false)} disabled={isUpdatingName} color="inherit">Cancel</Button>
          <Button onClick={handleSaveName} disabled={isUpdatingName} variant="contained" color="primary">
            {isUpdatingName ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
