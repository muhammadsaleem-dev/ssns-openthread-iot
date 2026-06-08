import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Slider, 
  Chip,
  LinearProgress,
  Switch,
  FormControlLabel,
  Tooltip,
  useTheme
} from '@mui/material';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ShieldIcon from '@mui/icons-material/Shield';
import SensorsIcon from '@mui/icons-material/Sensors';
import TuneIcon from '@mui/icons-material/Tune';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { fetchNodes, fetchMlStatus, updateMlConfig } from '../services/api';

function MLNodeCard({ node, onReset, onToggleEnabled }) {
  const theme = useTheme();
  // We use the node's properties from Java Backend as source of truth for config
  const [windowSize, setWindowSize] = useState(node.baselineWindowSize || 20);
  const [sensitivity, setSensitivity] = useState(node.sensitivity || 5);
  const [forecastHorizon, setForecastHorizon] = useState(node.forecastHorizonMin || 30);
  const [isEnabled, setIsEnabled] = useState(node.mlEnabled !== false);
  const [isResetting, setIsResetting] = useState(false);

  // ML Service state
  const mlState = node.mlStatus || {};
  const [localFitted, setLocalFitted] = useState(mlState.fitted || false);
  const [localSamples, setLocalSamples] = useState(mlState.baseline_samples_collected || 0);
  const [localTarget, setLocalTarget] = useState(mlState.baseline_window_size || windowSize);

  const isFitted = localFitted;
  const progressPercent = Math.min(100, Math.round((localSamples / localTarget) * 100));
  
  const remainingSamples = Math.max(0, localTarget - localSamples);
  
  // Based on firmware analysis (main.c), the sensor node sleeps for 30 seconds between transmissions
  const estimatedSeconds = remainingSamples * 30;
  const estimatedMinutes = Math.ceil(estimatedSeconds / 60);
  
  let etaText = '';
  if (remainingSamples > 0) {
    if (estimatedSeconds < 60) {
      etaText = '< 1 min remaining';
    } else {
      etaText = `~${estimatedMinutes} mins remaining`;
    }
  }

  const handleToggleEnabled = async (checked) => {
    setIsEnabled(checked);
    if (onToggleEnabled) {
      await onToggleEnabled(node.nodeId, checked, windowSize, sensitivity, forecastHorizon);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    if (onReset) {
      await onReset(node.nodeId, windowSize, sensitivity, forecastHorizon);
    }
    // Optimistically update local state so UI feels fast
    setLocalFitted(false);
    setLocalSamples(0);
    setLocalTarget(windowSize);
    setIsResetting(false);
  };

  const baseBorderColor = !isEnabled ? theme.palette.text.disabled : (isFitted ? theme.palette.success.main : theme.palette.warning.main);
  const baseBgColor = !isEnabled ? 'rgba(0,0,0,0.02)' : (isFitted ? 'rgba(16, 185, 129, 0.03)' : 'rgba(245, 158, 11, 0.03)');

  return (
    <Card 
      sx={{ 
        height: '100%',
        border: `1px solid ${baseBorderColor}40`,
        bgcolor: baseBgColor,
        transition: 'all 0.2s ease',
        opacity: isEnabled ? 1 : 0.7,
        '&:hover': {
          boxShadow: `0 4px 20px ${baseBorderColor}20`,
        }
      }}
    >
      <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {node.location || 'Unnamed Room'}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mt: 0.5, pr: 2 }}>
              <SensorsIcon sx={{ fontSize: 14, mr: 0.5 }} /> {node.nodeId}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
            <Chip 
              label={node.status} 
              size="small"
              color={node.status === 'ONLINE' ? 'success' : 'default'}
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
            />
            <FormControlLabel
              control={
                <Switch 
                  size="small" 
                  checked={isEnabled} 
                  onChange={(e) => handleToggleEnabled(e.target.checked)} 
                  color="primary"
                />
              }
              label={
                <Tooltip enterTouchDelay={0} leaveTouchDelay={4000} title="When ENABLED, the ML model will monitor this room (after it finishes learning the baseline). Turn to PAUSED to completely ignore alerts (e.g., during room maintenance).">
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'help' }}>
                    {isEnabled ? 'ML ENABLED' : 'ML PAUSED'}
                    <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5 }} />
                  </Typography>
                </Tooltip>
              }
              labelPlacement="start"
              sx={{ m: 0 }}
            />
          </Box>
        </Box>

        {/* ML Status Indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          {!isEnabled ? (
            <>
              <ShieldIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                Monitoring Disabled
              </Typography>
            </>
          ) : isFitted ? (
            <>
              <ShieldIcon sx={{ color: 'success.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                Active & Guarding
              </Typography>
              {mlState.current_score != null && (
                <Chip 
                  label={`Score: ${mlState.current_score > 0 ? '+' : ''}${mlState.current_score}`}
                  size="small"
                  variant="outlined"
                  color="success"
                  sx={{ ml: 'auto', height: 20, fontSize: '0.7rem' }}
                />
              )}
            </>
          ) : (
            <>
              <PsychologyIcon sx={{ color: 'warning.main', fontSize: 20 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.main' }}>
                Learning Environment...
              </Typography>
            </>
          )}
        </Box>

        {/* Progress Bar (if learning) */}
        {isEnabled && !isFitted && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {localSamples} / {localTarget} samples
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {progressPercent}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={progressPercent} 
              color="warning"
              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
            />
            <Typography variant="caption" sx={{ color: 'warning.main', fontStyle: 'italic', display: 'block', textAlign: 'right' }}>
              {etaText}
            </Typography>
          </Box>
        )}

        {/* Controls */}
        <Box sx={{ mt: 'auto', pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          
          <Box sx={{ mb: 2 }}>
            <Typography id="baseline-slider" variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mb: 4 }}>
              Baseline Window (samples)
              <Tooltip enterTouchDelay={0} leaveTouchDelay={4000} title="How long the sensor should 'learn' the room before it starts guarding. A larger window means it learns more variations of normal.">
                <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, cursor: 'help' }} />
              </Tooltip>
            </Typography>
            <Box sx={{ px: 1 }}>
              <Slider
                aria-labelledby="baseline-slider"
                value={windowSize}
                onChange={(_, newValue) => setWindowSize(newValue)}
                step={20}
                marks={[{value: 20}, {value: 120, label: '1h'}, {value: 1440, label: '12h'}, {value: 2880, label: '24h'}]}
                min={20}
                max={2880}
                valueLabelDisplay="auto"
                valueLabelFormat={(val) => {
                  if (val < 120) return `${val} (${val/2}m)`;
                  return `${val} (${(val/120).toFixed(1)}h)`;
                }}
                size="small"
                disabled={isResetting || !isEnabled}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
              <Typography id="sensitivity-slider" variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                Sensitivity
                <Tooltip enterTouchDelay={0} leaveTouchDelay={4000} title="How strict the guard should be. Lower sensitivity means fewer false alarms, but it might miss small changes. Higher sensitivity catches everything but might trigger false alarms.">
                  <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {sensitivity}%
              </Typography>
            </Box>
            <Box sx={{ px: 1 }}>
              <Slider
                aria-labelledby="sensitivity-slider"
                value={sensitivity}
                onChange={(_, newValue) => setSensitivity(newValue)}
                step={1}
                min={1}
                max={15}
                size="small"
                color="secondary"
                disabled={isResetting || !isEnabled}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
              <Typography id="forecast-slider" variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                Forecast Horizon
                <Tooltip enterTouchDelay={0} leaveTouchDelay={4000} title="How far into the future the proactive forecaster should predict. A 15-30 minute window provides the most accurate and actionable projections.">
                  <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, cursor: 'help' }} />
                </Tooltip>
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {forecastHorizon} mins
              </Typography>
            </Box>
            <Box sx={{ px: 1 }}>
              <Slider
                aria-labelledby="forecast-slider"
                value={forecastHorizon}
                onChange={(_, newValue) => setForecastHorizon(newValue)}
                step={5}
                marks={[{value: 15, label: '15m'}, {value: 30, label: '30m'}, {value: 60, label: '1h'}]}
                min={5}
                max={120}
                size="small"
                color="info"
                disabled={isResetting || !isEnabled}
              />
            </Box>
          </Box>

          <Button 
            variant="contained" 
            fullWidth 
            onClick={handleReset}
            disabled={isResetting || !isEnabled}
            startIcon={<TuneIcon />}
            sx={{ fontWeight: 600 }}
          >
            {isResetting ? 'Calibrating...' : 'Calibrate'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AnomalyDetectionSettingsPage() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [fetchedNodes, statusData] = await Promise.all([
        fetchNodes(),
        fetchMlStatus().catch(() => ({ nodes: {} }))
      ]);

      const mergedNodes = fetchedNodes.map(node => ({
        ...node,
        mlStatus: statusData.nodes[node.nodeId] || {}
      }));
      setNodes(mergedNodes);
    } catch (err) {
      console.error("Failed to load ML data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll every 10 seconds to update sample progress
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleResetNode = async (nodeId, newWindowSize, newSensitivity, newForecastHorizon) => {
    await updateMlConfig(nodeId, true, newWindowSize, newSensitivity, newForecastHorizon, true);
    await loadData();
  };

  const handleToggleNode = async (nodeId, enabled, windowSize, sensitivity, forecastHorizon) => {
    await updateMlConfig(nodeId, enabled, windowSize, sensitivity, forecastHorizon, false);
    await loadData();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PsychologyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          ML Settings
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 800 }}>
          Manage the Machine Learning environment models for your sensor nodes. 
          When a sensor is moved to a new room, recalibrate its baseline so the anomaly detector learns the new "normal".
        </Typography>
      </Box>

      {loading ? (
        <LinearProgress />
      ) : (
        <Grid container spacing={3}>
          {nodes.map(node => (
            <Grid item xs={12} sm={6} md={4} key={node.nodeId}>
              <MLNodeCard node={node} onReset={handleResetNode} onToggleEnabled={handleToggleNode} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
