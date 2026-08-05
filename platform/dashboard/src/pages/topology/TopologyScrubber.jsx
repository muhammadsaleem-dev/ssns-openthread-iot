import React, { useState, useEffect, useMemo } from 'react';
import { Box, Slider, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestoreIcon from '@mui/icons-material/Restore';
import { fetchNetworkTopologyHistory } from '../../services/api';

export default function TopologyScrubber({ borderRouterId, onHistorySelected }) {
  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Calculate markers for significant network events (node changes, leader changes, etc.)
  const eventMarks = useMemo(() => {
    if (!historyTimeline || historyTimeline.length < 2) return [];
    
    const marks = [];
    for (let i = 1; i < historyTimeline.length; i++) {
      const prev = historyTimeline[i - 1];
      const curr = historyTimeline[i];
      
      let eventType = null;
      let eventColor = '';
      let eventLabel = '';

      const prevNodes = prev.nodes || [];
      const currNodes = curr.nodes || [];
      const prevLeader = prevNodes.find(n => n.role?.toLowerCase() === 'leader')?.extAddr;
      const currLeader = currNodes.find(n => n.role?.toLowerCase() === 'leader')?.extAddr;

      // Check Gateway offline status change (highest priority)
      if (prev.gatewayHealth?.status !== curr.gatewayHealth?.status) {
        eventType = 'gateway';
        eventColor = '#ef4444'; // Red
        eventLabel = `Gateway ${curr.gatewayHealth?.status === 'ONLINE' ? 'Online' : 'Offline'}`;
      }
      // Check leader change
      else if (prevLeader !== currLeader) {
        eventType = 'leader';
        eventColor = '#f59e0b'; // Orange
        eventLabel = 'Leader Changed';
      }
      // Check node count change
      else if (prevNodes.length !== currNodes.length) {
        const isJoined = prevNodes.length < currNodes.length;
        eventType = 'node';
        eventColor = isJoined ? '#10b981' : '#6b7280'; // Green for Joined, Grey for Offline
        eventLabel = isJoined ? 'Node Joined' : 'Node Offline';
      }
      // Check role change (Self-Healing Promotion/Demotion)
      else {
        for (const currNode of currNodes) {
          const prevNode = prevNodes.find(n => n.extAddr === currNode.extAddr);
          if (prevNode && prevNode.role && currNode.role && prevNode.role.toLowerCase() !== currNode.role.toLowerCase()) {
            // Ignore leader changes as they are handled by the orange dot above
            if (prevNode.role.toLowerCase() !== 'leader' && currNode.role.toLowerCase() !== 'leader') {
              eventType = 'role_change';
              eventColor = '#8b5cf6'; // Purple
              const formatRole = (r) => r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
              eventLabel = `Self-Healing: ${formatRole(prevNode.role)} → ${formatRole(currNode.role)}`;
              break;
            }
          }
        }
      }

      if (eventType) {
        marks.push({ 
          value: i, 
          label: (
            <Tooltip title={eventLabel} placement="top" arrow>
              <Box 
                sx={{
                  width: 4,
                  height: 10,
                  bgcolor: eventColor,
                  borderRadius: 1,
                  cursor: 'pointer',
                  zIndex: 10
                }}
              />
            </Tooltip>
          )
        });
      }
    }
    return marks;
  }, [historyTimeline]);

  useEffect(() => {
    if (!borderRouterId) return;

    let mounted = true;
    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await fetchNetworkTopologyHistory(borderRouterId);
        if (mounted) {
          setHistoryTimeline(prevTimeline => {
            setCurrentIndex(currIdx => {
              // Only snap to the newest snapshot if we were already at the newest one,
              // or if this is the very first time we are loading data.
              if (prevTimeline.length === 0 || currIdx === prevTimeline.length - 1) {
                return data.length - 1;
              }
              return currIdx;
            });
            return data;
          });
        }
      } catch (error) {
        console.error("Failed to load topology history:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadHistory();
    // Refresh history every 10 seconds to get the latest timeline chunks
    const interval = setInterval(loadHistory, 10000);
    
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [borderRouterId]);

  // Handle Playback
  useEffect(() => {
    let timer;
    if (isPlaying && historyTimeline.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= historyTimeline.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500); // 1.5 seconds per snapshot during playback
    }
    return () => clearInterval(timer);
  }, [isPlaying, historyTimeline.length]);

  // When currentIndex changes, emit the selected snapshot up to the parent
  useEffect(() => {
    if (historyTimeline.length === 0) return;
    
    if (currentIndex === -1 || currentIndex >= historyTimeline.length) {
      // Revert to LIVE data
      onHistorySelected(null);
    } else {
      const snapshot = historyTimeline[currentIndex];
      // Adapt the snapshot back into the shape expected by useTopologyGraph
      onHistorySelected({
        ...snapshot,
        lastUpdatedAt: snapshot.recordedAt // Use recordedAt as the 'lastUpdatedAt' time
      });
    }
  }, [currentIndex, historyTimeline, onHistorySelected]);

  const handleSliderChange = (event, newValue) => {
    setIsPlaying(false);
    setCurrentIndex(newValue);
  };

  const handleResetToLive = () => {
    setIsPlaying(false);
    setCurrentIndex(historyTimeline.length - 1);
    onHistorySelected(null);
  };

  if (!borderRouterId) return null;

  if (loading && historyTimeline.length === 0) {
    return <Box sx={{ p: 2, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
  }

  if (historyTimeline.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
        <Typography variant="caption">No historical data available yet. Waiting for snapshots...</Typography>
      </Box>
    );
  }

  const currentSnapshot = currentIndex >= 0 && currentIndex < historyTimeline.length 
    ? historyTimeline[currentIndex] 
    : null;

  const displayTime = currentSnapshot 
    ? new Date(currentSnapshot.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'LIVE';

  return (
    <Box sx={{ px: 4, py: 2, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" color="primary" fontWeight="bold">
          Historical Topology Scrubber ⏳
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: currentSnapshot ? 'error.main' : 'success.main' }}>
          {currentSnapshot ? `TIMETRAVEL: ${displayTime}` : 'LIVE FEED'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title={isPlaying ? "Pause Playback" : "Play History"}>
          <IconButton color="primary" onClick={() => setIsPlaying(!isPlaying)}>
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Tooltip>

        <Slider
          value={currentIndex}
          min={0}
          max={historyTimeline.length - 1}
          onChange={handleSliderChange}
          step={1}
          marks={eventMarks}
          valueLabelDisplay="off"
          sx={{ 
            flexGrow: 1,
            '& .MuiSlider-mark': {
              display: 'none',
            },
            '& .MuiSlider-markLabel': {
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }
          }}
        />

        <Tooltip title="Reset to Live">
          <IconButton color="secondary" onClick={handleResetToLive}>
            <RestoreIcon />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
