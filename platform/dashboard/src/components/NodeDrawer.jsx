import React from 'react';
import { Box, Typography, Drawer, IconButton, Divider } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SensorsIcon from '@mui/icons-material/Sensors';
import StatisticsTab from './StatisticsTab';
import { formatTimestamp } from '../utils/format';

const PropRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-all', pl: 2 }}>
      {value}
    </Typography>
  </Box>
);

export default function NodeDrawer({ node, sensorData, open, onClose }) {
  if (!node) return null;

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400, md: 450 } } }}>
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <SensorsIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
              {node.location || 'Unnamed Node'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ID: {node.nodeId}
            </Typography>
          </Box>
          <IconButton onClick={onClose} edge="end">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', color: 'primary.main' }}>
            System Status
          </Typography>
          <PropRow label="Network State" value={node.status} />
          <PropRow label="Last Uplink" value={formatTimestamp(node.lastSeenAt)} />
          <PropRow label="Registration" value={formatTimestamp(node.registeredAt)} />
          
          <Divider sx={{ my: 2 }} />
          
          {sensorData && (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', color: 'primary.main' }}>
                IPv6 Topology
              </Typography>
              <PropRow label="Mesh Network ID" value={sensorData.meshId || 'N/A'} />
              <PropRow label="IPv6 Address" value={sensorData.ipv6Address || 'N/A'} />
              <Divider sx={{ my: 2 }} />
            </>
          )}

          {sensorData ? (
            <StatisticsTab data={sensorData} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', mt: 4 }}>
              No telemetry data available for this node.
            </Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}
