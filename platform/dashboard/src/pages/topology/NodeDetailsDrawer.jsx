import { useState, useEffect } from 'react';
import { Box, Typography, Drawer, IconButton, Chip, alpha, useTheme, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip as RechartsTooltip, XAxis } from 'recharts';
import { formatExtAddr } from '../../utils/format';
import { NodeInfoExplainerButton } from './NodeInfoExplainerDialog';
import API from '../../config/api';

const roleColors = {
  leader: '#F59E0B',
  router: '#3B82F6',
  endDevice: '#10B981',
};

const rowSx = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: 30,
  px: 2,
  borderBottom: '1px solid',
  borderColor: 'divider',
};

function PropRow({ label, value, mono }) {
  return (
    <Box sx={rowSx}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600, letterSpacing: 0.5, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: mono ? 'monospace' : undefined,
          fontSize: '0.75rem',
          color: mono ? 'primary.light' : 'text.primary',
          textAlign: 'right',
          wordBreak: 'break-all',
          ml: 2,
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function SectionHeader({ label }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        ...rowSx,
        bgcolor: alpha(theme.palette.primary.main, 0.04),
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: '0.6rem',
          letterSpacing: 1.2,
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

export default function NodeDetailsDrawer({ node, onClose }) {
  const theme = useTheme();
  const role = node?.data?.role || 'endDevice';
  const color = roleColors[role] || roleColors.endDevice;

  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (node?.data?.extAddr) {
      setLoading(true);
      fetch(`${API.BASE_URL}/api/network/topology/node-history/${node.data.extAddr}`)
        .then(res => res.json())
        .then(data => {
          const formatted = data.map(d => ({
             ...d,
             time: new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setHistory(formatted);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setHistory(null);
    }
  }, [node]);

  return (
    <Drawer
      anchor="right"
      open={Boolean(node)}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 350 }, bgcolor: 'background.default' }
      }}
    >
      {node && (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header — one line, tight */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              minHeight: 44,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: alpha(color, 0.06),
            }}
          >
            <Typography sx={{ fontSize: '1.1rem', lineHeight: 1 }}>{role === 'leader' ? '👑' : role === 'router' ? '📡' : '🍃'}</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.data.label}
            </Typography>
            <Chip
              label={node.data.status}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.6rem',
                fontWeight: 700,
                bgcolor: node.data.status === 'ONLINE' ? alpha(theme.palette.success.main, 0.15) : node.data.status === 'OFFLINE' ? alpha(theme.palette.error.main, 0.15) : alpha(theme.palette.grey[500], 0.15),
                color: node.data.status === 'ONLINE' ? 'success.main' : node.data.status === 'OFFLINE' ? 'error.main' : 'text.secondary',
              }}
            />
            <NodeInfoExplainerButton />
            <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary', ml: -0.5 }}>
              <CloseIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Box>

          {/* Property table */}
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <SectionHeader label="IDENTITY" />
            <PropRow label="Hardware ID" value={node.data.hardwareId} />
            <PropRow label="EUI-64" value={formatExtAddr(node.data.extAddr)} mono />
            <PropRow label="RLOC16" value={node.data.rloc16} mono />

            <SectionHeader label="NETWORK" />
            <PropRow
              label="Parent"
              value={
                role === 'leader' ? 'None (Root)'
                : role === 'router' ? 'N/A (mesh-routed)'
                : node.data.parentRloc16
              }
              mono
            />
            <PropRow label="Link Quality" value={node.data.hasRealLinkQuality ? `${node.data.linkQualityIn || 0}% / ${node.data.linkQualityOut || 0}%` : 'N/A'} />
            <PropRow label="IPv6" value={node.data.ipv6Address || 'Not reported by mesh telemetry'} mono={!!node.data.ipv6Address} />

            <SectionHeader label="STATUS" />
            <PropRow label="Last Seen" value={node.data.lastSeenAt ? new Date(node.data.lastSeenAt).toLocaleString() : 'N/A'} />
            
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', fontWeight: 600, letterSpacing: 0.5, mb: 1, display: 'block' }}>
                SIGNAL QUALITY (LINK-IN)
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} /></Box>
              ) : history && history.length > 0 ? (
                <Box sx={{ height: 60, width: '100%', mt: 1 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={history}>
                      <YAxis domain={[0, 100]} hide />
                      <XAxis dataKey="time" hide />
                      <RechartsTooltip 
                        contentStyle={{ fontSize: '10px', padding: '4px 8px', borderRadius: '4px', backgroundColor: theme.palette.background.paper }}
                        labelStyle={{ display: 'none' }}
                        itemStyle={{ color: theme.palette.primary.main }}
                        formatter={(value) => [`LQI: ${value}`, '']}
                      />
                      <Line type="stepAfter" dataKey="linkQualityIn" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>No historical data available</Typography>
              )}
            </Box>

            <PropRow label="Firmware" value="Not reported in current CBOR payload" />
          </Box>
        </Box>
      )}
    </Drawer>
  );
}
