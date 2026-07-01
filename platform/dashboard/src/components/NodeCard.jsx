import { useState } from 'react';
import { Card, CardContent, Typography, Box, Chip, IconButton, TextField, CircularProgress, Tooltip } from '@mui/material';
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
import { useAuth } from '../context/AuthContext';

const MetricBox = ({ icon: Icon, label, value, unit, color, precision = 1 }) => {
  const isFault = value != null && value <= -998.5; // -999.0
  const isWarmup = value != null && value > -998.5 && value <= -997.5; // -998.0
  
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
        <Icon sx={{ fontSize: 14, mr: 0.5, color }} /> {label}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: isFault ? '#EF4444' : (isWarmup ? '#F59E0B' : 'inherit') }}>
        {value != null ? (isFault ? 'FAULT' : (isWarmup ? 'WARMUP' : (precision === 0 ? Math.round(value) : value.toFixed(precision)))) : '--'} 
        {value != null && !isFault && !isWarmup && (
          <Typography component="span" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>{unit}</Typography>
        )}
      </Typography>
    </Box>
  );
};

export default function NodeCard({ node, latestTelemetry, hasActiveAlerts, onLocationUpdated, isSelected, onClick }) {
  const { isAdmin } = useAuth();
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
                <Tooltip title={!isAdmin ? "Admin privileges required to rename nodes" : "Edit Room Name"}>
                  <span>
                    <IconButton size="small" disabled={!isAdmin} onClick={(e) => {
                      e.stopPropagation(); // Don't trigger card selection
                      setLocationValue(node.location || '');
                      setIsEditing(true);
                    }} sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
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
            <MetricBox icon={ThermostatIcon} label="Temp" value={latestTelemetry.temperature} unit="°C" color="#3B82F6" precision={1} />
            <MetricBox icon={WaterDropIcon} label="Humid" value={latestTelemetry.humidity} unit="%" color="#3B82F6" precision={0} />
            
            <MetricBox icon={AirIcon} label="CO2" value={latestTelemetry.co2} unit="ppm" color="#10B981" precision={0} />
            <MetricBox icon={CloudOutlinedIcon} label="TVOC" value={latestTelemetry.tvoc} unit="ppb" color="#F59E0B" precision={0} />
            
            <MetricBox icon={AirIcon} label="PM2.5" value={latestTelemetry.pm2_5} unit="µg" color="#6366F1" precision={1} />
            <MetricBox icon={AirIcon} label="PM10" value={latestTelemetry.pm10} unit="µg" color="#8B5CF6" precision={1} />
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
