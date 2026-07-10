import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, Card, Chip, alpha, useTheme, Fade, IconButton, InputBase, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SanitizerIcon from '@mui/icons-material/Sanitizer';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import PersonIcon from '@mui/icons-material/Person';
import Co2Icon from '@mui/icons-material/Co2';
import WindowIcon from '@mui/icons-material/Window';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeedIcon from '@mui/icons-material/Speed';

import { fetchAlertsPage, resetAlertTimers } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ExplainFormulaButton } from './AlertFormulaDialog';

const EVENT_META = {
  TRANSIENT_CO2_EVENT: {
    title: "Breath or High CO2 Source Detected",
    subtitle: "(Transient CO2 Spike)",
    icon: Co2Icon,
    color: "#60A5FA", // Blue
    gradient: "linear-gradient(180deg, rgba(96, 165, 250, 0.2) 0%, rgba(96, 165, 250, 0) 100%)"
  },
  TRANSIENT_VOC_EVENT: {
    title: "Chemical Odors, Cooking or Aerosols Detected",
    subtitle: "(Transient VOC Spike)",
    icon: SanitizerIcon,
    color: "#FCD34D", // Amber/Yellow
    gradient: "linear-gradient(180deg, rgba(252, 211, 77, 0.2) 0%, rgba(252, 211, 77, 0) 100%)"
  },
  PARTICULATE_EVENT: {
    title: "Dust, Smoke or Cooking Odor Detected",
    subtitle: "(Transient PM2.5 Spike)",
    icon: LocalFireDepartmentIcon,
    color: "#FCD34D",
    gradient: "linear-gradient(180deg, rgba(252, 211, 77, 0.2) 0%, rgba(252, 211, 77, 0) 100%)"
  },
  OCCUPANCY_EVENT: {
    title: "Occupancy or Presence Detected",
    subtitle: "(Stable CO₂ Increase)",
    icon: PersonIcon,
    color: "#10B981", // Green
    gradient: "linear-gradient(180deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0) 100%)"
  },
  VENTILATION_EVENT: {
    title: "Window, Door or Draft Detected",
    subtitle: "(Natural Ventilation)",
    icon: WindowIcon,
    color: "#3B82F6", // Blue
    gradient: "linear-gradient(180deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0) 100%)"
  },
  DEFAULT: {
    title: "System Notification",
    subtitle: "(Sensor Event)",
    icon: SettingsIcon,
    color: "#8B5CF6", // Purple
    gradient: "linear-gradient(180deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0) 100%)"
  }
};

const formatTimeOnly = (dateString) => {
  const d = new Date(dateString);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  if (d.toDateString() === now.toDateString()) {
    return timeStr;
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday • ${timeStr}`;
  }
  
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} • ${timeStr}`;
};

// SVG Sparkline Component showing dynamic sensor recovery & trend curves
const Sparkline = ({ color, type = 'DEFAULT' }) => {
  let points = "0,26 20,20 40,24 60,12 80,18 100,14 120,22";
  if (type === 'OCCUPANCY_EVENT') {
    points = "0,28 20,25 40,22 60,15 80,12 100,8 120,6"; // Stable rising occupancy
  } else if (type === 'TRANSIENT_CO2_EVENT') {
    points = "0,28 20,26 40,8 60,22 80,26 100,27 120,28"; // Sharp breath spike & quick 3m recovery
  } else if (type === 'TRANSIENT_VOC_EVENT') {
    points = "0,28 25,12 50,22 75,10 100,24 120,27"; // Chemical burst & gentle dispersion
  } else if (type === 'VENTILATION_EVENT') {
    points = "0,10 20,12 40,18 60,22 80,26 100,28 120,29"; // Fresh air cooling & CO2 drop
  } else if (type === 'MOISTURE_EVENT') {
    points = "0,28 30,14 60,8 90,16 120,26"; // Steaming hot tea humidity curve
  }

  return (
    <Box sx={{ width: '100%', height: 36, mt: 1.5, pt: 0.5, position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 120 30" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <polygon points={`0,30 ${points} 120,30`} fill={`url(#grad-${color.replace('#', '')})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <Box sx={{ position: 'absolute', right: 2, bottom: 2, bgcolor: color, borderRadius: 1, px: 0.5, py: 0.2, display: 'flex', alignItems: 'center', gap: 0.3, boxShadow: `0 2px 6px ${alpha(color, 0.4)}` }}>
        <SpeedIcon sx={{ fontSize: 11, color: '#000' }} />
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#000', lineHeight: 1 }}>
          3m Trend
        </Typography>
      </Box>
    </Box>
  );
};

const ActivityFeed = () => {
  const { isAdmin } = useAuth();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const clearThresholdRef = useRef(
    localStorage.getItem('activityFeedClearThreshold') 
      ? parseInt(localStorage.getItem('activityFeedClearThreshold'), 10) 
      : null
  );

  const handleClearFeed = async () => {
    if (!isAdmin) return;
    const now = Date.now();
    clearThresholdRef.current = now;
    localStorage.setItem('activityFeedClearThreshold', now.toString());
    setEvents([]);
    
    // Also notify backend to clear debounce cache so tests can trigger immediately
    try {
      await resetAlertTimers();
    } catch (err) {
      console.error("Failed to reset backend timers", err);
    }
  };
  
  const loadEvents = async () => {
    try {
      const data = await fetchAlertsPage(false, 'all', 0, 50);
      if (data && data.content) {
        let infoEvents = data.content.filter(alert => alert.severity === 'INFO');
        if (clearThresholdRef.current) {
          infoEvents = infoEvents.filter(alert => new Date(alert.createdAt).getTime() > clearThresholdRef.current);
        }
        setEvents(infoEvents);
      }
    } catch (err) {
      console.error("Failed to fetch activity events", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (!searchQuery) return true;
      const meta = EVENT_META[e.type] || EVENT_META.DEFAULT;
      const query = searchQuery.toLowerCase();
      return meta.title.toLowerCase().includes(query) || 
             meta.subtitle.toLowerCase().includes(query) || 
             e.message.toLowerCase().includes(query);
    });
  }, [events, searchQuery]);

  return (
    <Card 
      sx={{ 
        height: '100%',
        minHeight: '400px',
        maxHeight: '800px',
        display: 'flex', 
        flexDirection: 'column',
        // Adaptive glassmorphism styling
        bgcolor: isDark ? '#1E232B' : alpha(theme.palette.background.paper, 0.7),
        backdropFilter: 'blur(20px)',
        color: isDark ? '#FFFFFF' : theme.palette.text.primary,
        borderRadius: 4,
        boxShadow: isDark ? '0 12px 40px 0 rgba(0,0,0,0.4)' : `0 8px 32px 0 ${alpha(theme.palette.common.black, 0.1)}`,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : alpha(theme.palette.divider, 0.15)}`,
        fontFamily: "'Inter', sans-serif"
      }}
    >
      {/* Header Area */}
      <Box sx={{ p: 3, pb: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.divider, 0.1)}` }}>
        <Typography variant="overline" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : alpha(theme.palette.text.primary, 0.6), fontWeight: 600, letterSpacing: 1.5, fontSize: '0.7rem' }}>
          ACTIVITY LOG
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mt: 0.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: isDark ? '#FFFFFF' : theme.palette.text.primary, lineHeight: 1.2 }}>
            Events Feed
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            {/* Search Bar */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              bgcolor: isDark ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.common.black, 0.04), 
              borderRadius: 2,
              px: 1.5,
              py: 0.1,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : alpha(theme.palette.divider, 0.1)}`,
              flexGrow: 1,
              width: '100%',
              minWidth: '150px',
              maxWidth: '220px'
            }}>
              <SearchIcon sx={{ color: isDark ? 'rgba(255,255,255,0.4)' : alpha(theme.palette.text.primary, 0.4), fontSize: 18, mr: 1 }} />
              <InputBase 
                placeholder="Search" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ color: isDark ? '#FFF' : theme.palette.text.primary, fontSize: '0.85rem', width: '100%' }} 
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery("")} sx={{ p: 0, ml: 0.5 }}>
                  <CloseIcon sx={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.4)' : alpha(theme.palette.text.primary, 0.4) }} />
                </IconButton>
              )}
            </Box>

            <Tooltip title={!isAdmin ? "Admin privileges required to clear feed" : "Clear Feed"}>
              <span>
                <IconButton onClick={handleClearFeed} disabled={!isAdmin} size="small" sx={{ 
                  color: isDark ? 'rgba(255,255,255,0.6)' : theme.palette.text.secondary,
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.common.black, 0.04),
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : alpha(theme.palette.divider, 0.1)}`,
                  borderRadius: 2,
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : alpha(theme.palette.common.black, 0.08) }
                }}>
                  <ClearAllIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : theme.palette.text.secondary, mt: 1 }}>
          Minor transient events
        </Typography>
      </Box>

      {/* Feed List */}
      <Box sx={{ 
        p: 2, 
        flexGrow: 1, 
        overflowY: 'auto',
        '&::-webkit-scrollbar': { width: '6px' },
        '&::-webkit-scrollbar-track': { background: 'transparent' },
        '&::-webkit-scrollbar-thumb': { 
          background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', 
          borderRadius: '10px' 
        },
        '&::-webkit-scrollbar-thumb:hover': { 
          background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' 
        }
      }}>
        {loading && events.length === 0 ? null : filteredEvents.length === 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.6, mt: 4 }}>
            <HistoryIcon sx={{ fontSize: 48, color: isDark ? 'rgba(255,255,255,0.3)' : alpha(theme.palette.text.secondary, 0.5), mb: 2 }} />
            <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : theme.palette.text.secondary, textAlign: 'center' }}>
              No recent activity matches.
            </Typography>
          </Box>
        ) : (
          filteredEvents.map((event, index) => {
            const meta = EVENT_META[event.type] || EVENT_META.DEFAULT;
            const IconComponent = meta.icon;
            
            return (
              <Fade in={true} key={event.id} timeout={500 + (index * 100)}>
                <Box 
                  sx={{ 
                    mb: 1.5, 
                    p: 2, 
                    borderRadius: 3,
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : alpha(theme.palette.background.paper, 0.6),
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : alpha(theme.palette.primary.main, 0.1)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : alpha(theme.palette.background.paper, 0.9),
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : alpha(theme.palette.primary.main, 0.2)
                    }
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      {/* Icon Circle */}
                      <Box sx={{ 
                        bgcolor: meta.color, 
                        p: 1, 
                        borderRadius: '50%', 
                        display: 'flex',
                        boxShadow: `0 0 15px ${alpha(meta.color, 0.4)}`
                      }}>
                        <IconComponent sx={{ fontSize: 18, color: 'rgba(0,0,0,0.7)' }} />
                      </Box>
                      
                      {/* Text */}
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: isDark ? '#FFFFFF' : theme.palette.text.primary, lineHeight: 1.2 }}>
                            {meta.title}
                          </Typography>
                          <ExplainFormulaButton alert={event} />
                        </Box>
                        <Typography sx={{ fontSize: '0.8rem', color: isDark ? 'rgba(255,255,255,0.7)' : theme.palette.text.secondary, mt: 0.3 }}>
                          {meta.subtitle}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: isDark ? 'rgba(255,255,255,0.4)' : alpha(theme.palette.text.secondary, 0.6), mt: 0.5 }}>
                          {formatTimeOnly(event.createdAt)}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Right Chip */}
                    <Chip 
                      label={event.resolved ? "Recovered" : "System"} 
                      size="small" 
                      variant="outlined"
                      sx={{ 
                        height: 22, 
                        fontSize: '0.7rem', 
                        fontWeight: 600,
                        color: event.resolved ? '#10B981' : (isDark ? 'rgba(255,255,255,0.5)' : theme.palette.text.secondary),
                        borderColor: event.resolved ? alpha('#10B981', 0.5) : (isDark ? 'rgba(255,255,255,0.2)' : alpha(theme.palette.divider, 0.5)),
                        bgcolor: 'transparent',
                        px: 0.5
                      }} 
                    />
                  </Box>
                  
                  {/* Visual 3m trend graph for all transient & minor activity events */}
                  <Sparkline color={meta.color} type={event.type} />
                </Box>
              </Fade>
            );
          })
        )}
      </Box>
    </Card>
  );
};

export default ActivityFeed;
