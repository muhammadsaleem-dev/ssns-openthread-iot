import { useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, TextField, CircularProgress } from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import AirIcon from '@mui/icons-material/Air';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import SensorsIcon from '@mui/icons-material/Sensors';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';

import { updateNodeLocation } from '../services/api';

export default function NodeCard({ node, latestTelemetry, hasActiveAlerts, onLocationUpdated, isSelected, onClick }) {
  const [isEditing, setIsEditing] = useState(false);
  const [locationValue, setLocationValue] = useState(node.location || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSave = async () => {
    if (locationValue.trim() === node.location) {
      setIsEditing(false);
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateNodeLocation(node.nodeId, locationValue.trim());
      setIsEditing(false);
      if (onLocationUpdated) onLocationUpdated();
    } catch (error) {
      console.error("Failed to update location:", error);
      // Revert on error
      setLocationValue(node.location || '');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setLocationValue(node.location || '');
      setIsEditing(false);
    }
  };

  // Visual state based on alerts and selection
  const baseBorderColor = hasActiveAlerts ? '#EF4444' : '#10B981';
  const borderColor = isSelected ? '#3B82F6' : baseBorderColor; // Blue border if selected
  const baseBgColor = hasActiveAlerts ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)';
  const bgColor = isSelected ? 'rgba(59, 130, 246, 0.08)' : baseBgColor;
  const shadow = isSelected ? `0 0 0 2px #3B82F6, 0 4px 20px rgba(59, 130, 246, 0.2)` : 'none';

  return (
    <Card 
      onClick={(e) => {
        // Prevent card click if clicking on the edit input or buttons
        if (!isEditing) {
          onClick && onClick();
        }
      }}
      sx={{ 
        height: '100%',
        cursor: 'pointer',
        border: `1px solid ${borderColor}`,
        bgcolor: bgColor,
        boxShadow: shadow,
        transition: 'all 0.2s ease',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        '&:hover': {
          boxShadow: isSelected 
            ? shadow 
            : `0 4px 20px ${hasActiveAlerts ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`,
        }
      }}
    >
      <CardContent>
        {/* Header: Location Edit UI & Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flexGrow: 1, mr: 2 }}>
            {isEditing ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  autoFocus
                  size="small"
                  variant="outlined"
                  value={locationValue}
                  onChange={(e) => setLocationValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g. Server Room"
                  disabled={isUpdating}
                  sx={{ 
                    '& .MuiInputBase-input': { fontSize: '1.25rem', fontWeight: 600, py: 0.5 },
                  }}
                />
                {isUpdating ? (
                  <CircularProgress size={20} />
                ) : (
                  <>
                    <IconButton size="small" onClick={handleSave} color="primary">
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => setIsEditing(false)}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                  {node.location || 'Unnamed Room'}
                </Typography>
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation(); // Don't trigger card selection
                  setLocationValue(node.location || '');
                  setIsEditing(true);
                }} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', mt: 0.5 }}>
              <SensorsIcon sx={{ fontSize: 14, mr: 0.5 }} /> {node.nodeId}
            </Typography>
          </Box>
          
          <Chip 
            label={node.status} 
            size="small"
            color={node.status === 'ONLINE' ? 'success' : 'default'}
            sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
          />
        </Box>

        {/* Status Warning Banner */}
        {hasActiveAlerts && (
          <Box sx={{ 
            bgcolor: 'rgba(239, 68, 68, 0.1)', 
            borderRadius: 1, 
            p: 1, 
            mb: 2, 
            display: 'flex', 
            alignItems: 'center',
            color: '#EF4444'
          }}>
            <WarningAmberIcon sx={{ fontSize: 18, mr: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>WARNING: HIGH READINGS</Typography>
          </Box>
        )}

        {/* Telemetry Metrics */}
        {node.status === 'OFFLINE' ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
            Sensor is offline. No live data available.
          </Typography>
        ) : latestTelemetry ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
            {/* Row 1: Temp & Humidity */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <ThermostatIcon sx={{ fontSize: 14, mr: 0.5, color: '#3B82F6' }} /> Temp
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.temperature <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.temperature != null ? (latestTelemetry.temperature <= -900 ? 'FAULT' : latestTelemetry.temperature.toFixed(1)) : '--'} 
                {latestTelemetry.temperature != null && latestTelemetry.temperature > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>°C</Typography>
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <WaterDropIcon sx={{ fontSize: 14, mr: 0.5, color: '#3B82F6' }} /> Humid
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.humidity <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.humidity != null ? (latestTelemetry.humidity <= -900 ? 'FAULT' : latestTelemetry.humidity.toFixed(0)) : '--'} 
                {latestTelemetry.humidity != null && latestTelemetry.humidity > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>%</Typography>
                )}
              </Typography>
            </Box>

            {/* Row 2: CO2 & TVOC */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <AirIcon sx={{ fontSize: 14, mr: 0.5, color: '#10B981' }} /> CO2
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.co2 <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.co2 != null ? (latestTelemetry.co2 <= -900 ? 'FAULT' : Math.round(latestTelemetry.co2)) : '--'} 
                {latestTelemetry.co2 != null && latestTelemetry.co2 > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>ppm</Typography>
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <CloudOutlinedIcon sx={{ fontSize: 14, mr: 0.5, color: '#F59E0B' }} /> TVOC
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.tvoc <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.tvoc != null ? (latestTelemetry.tvoc <= -900 ? 'FAULT' : Math.round(latestTelemetry.tvoc)) : '--'} 
                {latestTelemetry.tvoc != null && latestTelemetry.tvoc > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>ppb</Typography>
                )}
              </Typography>
            </Box>

            {/* Row 3: PM 2.5 & PM 10 */}
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <AirIcon sx={{ fontSize: 14, mr: 0.5, color: '#6366F1' }} /> PM2.5
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.pm2_5 <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.pm2_5 != null ? (latestTelemetry.pm2_5 <= -900 ? 'FAULT' : latestTelemetry.pm2_5.toFixed(1)) : '--'} 
                {latestTelemetry.pm2_5 != null && latestTelemetry.pm2_5 > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>µg</Typography>
                )}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                <AirIcon sx={{ fontSize: 14, mr: 0.5, color: '#8B5CF6' }} /> PM10
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700, color: latestTelemetry.pm10 <= -900 ? '#EF4444' : 'inherit' }}>
                {latestTelemetry.pm10 != null ? (latestTelemetry.pm10 <= -900 ? 'FAULT' : latestTelemetry.pm10.toFixed(1)) : '--'} 
                {latestTelemetry.pm10 != null && latestTelemetry.pm10 > -900 && (
                  <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>µg</Typography>
                )}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic', py: 2 }}>
            Awaiting telemetry...
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
