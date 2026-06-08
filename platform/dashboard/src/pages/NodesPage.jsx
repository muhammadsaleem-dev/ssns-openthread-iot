/**
 * NodesPage — sensor node monitoring panel.
 *
 * Displays all registered nodes with their status, location,
 * and last-seen timestamps in a card grid layout.
 */

import { Box, Grid, Card, CardContent, Typography, alpha } from '@mui/material';
import SensorsIcon from '@mui/icons-material/Sensors';

import SectionHeader from '../components/SectionHeader';
import StatusChip from '../components/StatusChip';
import LoadingOverlay from '../components/LoadingOverlay';
import ErrorBanner from '../components/ErrorBanner';
import usePolling from '../hooks/usePolling';
import { fetchNodes } from '../services/api';
import { formatTimestamp } from '../utils/format';
import API from '../config/api';

export default function NodesPage() {
  const { data: nodes, loading, error } = usePolling(fetchNodes, API.POLL_INTERVAL);

  if (loading && !nodes) return <LoadingOverlay message="Loading node data..." />;

  const onlineCount = nodes ? nodes.filter((n) => n.status === 'ONLINE').length : 0;
  const totalCount = nodes ? nodes.length : 0;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Sensor Nodes
        </Typography>
        <Typography variant="subtitle1">
          {onlineCount} of {totalCount} nodes online
        </Typography>
      </Box>

      {error && <ErrorBanner />}

      <SectionHeader title="Registered Nodes" subtitle="Auto-registered on first telemetry" />

      <Grid container spacing={2.5}>
        {nodes && nodes.length > 0 ? (
          nodes.map((node) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={node.id || node.nodeId}>
              <Card
                sx={{
                  borderLeft: '3px solid',
                  borderLeftColor: node.status === 'ONLINE' ? 'secondary.main' : 'error.main',
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SensorsIcon sx={{ color: node.status === 'ONLINE' ? 'secondary.main' : 'text.secondary', fontSize: 20 }} />
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                        {node.location || node.name || node.nodeId}
                      </Typography>
                    </Box>
                    <StatusChip status={node.status} />
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <InfoRow label="Location" value={node.location || 'Not assigned'} />
                    <InfoRow label="Last Seen" value={formatTimestamp(node.lastSeenAt)} />
                    <InfoRow label="Registered" value={formatTimestamp(node.registeredAt)} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid size={12}>
            <Card>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  No sensor nodes registered yet. Start the BLE gateway to begin.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}
