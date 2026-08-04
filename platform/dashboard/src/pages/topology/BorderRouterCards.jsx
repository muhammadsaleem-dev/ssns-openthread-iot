import { Box, Card, CardContent, Typography, Grid, Chip, alpha, Divider, useTheme } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import { formatExtAddr } from '../../utils/format';

function BorderRouterCard({ topology }) {
  const theme = useTheme();
  const isOffline = topology.gatewayHealth?.status === 'offline';
  const selfNode = topology.nodes?.find(n => n.extAddr === topology.gatewayId);
  const isLeader = selfNode?.role?.toLowerCase() === 'leader';
  // ot-ctl router table always includes the local device's own row, so
  // topology.nodes always contains at least 2 self-mentions (the self-entry
  // plus that router-table row) even with zero real peers -- count only
  // genuinely distinct OTHER nodes.
  const connectedCount = topology.nodes
    ? new Set(topology.nodes.filter(n => n.extAddr !== topology.gatewayId).map(n => n.extAddr)).size
    : 0;

  return (
    <Card sx={{
      border: `1px solid ${isOffline ? alpha(theme.palette.text.disabled, 0.3) : alpha(theme.palette.primary.main, 0.3)}`,
      background: isOffline
        ? alpha(theme.palette.background.paper, 0.8)
        : `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(theme.palette.primary.dark, 0.05)} 100%)`,
      boxShadow: isOffline ? 'none' : `0 4px 20px 0 ${alpha(theme.palette.common.black, 0.2)}`,
      position: 'relative',
      overflow: 'hidden',
      opacity: isOffline ? 0.7 : 1,
      filter: isOffline ? 'grayscale(80%)' : 'none',
      transition: 'all 0.3s ease'
    }}>
      <Box sx={{ height: '4px', bgcolor: isOffline ? 'text.disabled' : 'primary.main', width: '100%', position: 'absolute', top: 0, left: 0 }} />

      <CardContent sx={{ p: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box sx={{
              bgcolor: isOffline ? alpha(theme.palette.text.disabled, 0.15) : alpha(theme.palette.primary.main, 0.15),
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <HubIcon fontSize="small" sx={{ color: isOffline ? 'text.disabled' : 'primary.main' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="bold" lineHeight={1.2} color={isOffline ? 'text.disabled' : 'text.primary'}>
                {topology.gatewayHealth?.networkName || 'Border Router'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                HW: {topology.hardwareId || 'UNKNOWN'}
              </Typography>
            </Box>
          </Box>
          <Chip
            label={isOffline ? 'OFFLINE' : (topology.gatewayHealth?.status?.toUpperCase() || 'ACTIVE')}
            color={isOffline ? 'default' : (topology.gatewayHealth?.status === 'active' ? 'success' : 'error')}
            size="small"
            sx={{ fontWeight: 'bold', fontSize: '0.7rem' }}
          />
        </Box>

        <Divider sx={{ my: 1.5, borderColor: alpha(theme.palette.divider, 0.5) }} />

        <Box sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" display="block">HARDWARE ID</Typography>
          <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace', color: isOffline ? 'text.disabled' : 'success.light', fontSize: '0.75rem' }}>
            {topology.hardwareId || 'UNKNOWN'}
          </Typography>
        </Box>
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block">NETWORK ID</Typography>
          <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace', color: isOffline ? 'text.disabled' : 'primary.light', fontSize: '0.75rem' }}>
            {formatExtAddr(topology.gatewayId)}
          </Typography>
        </Box>

        <Grid container spacing={1.5}>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary" display="block">PAN ID</Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ fontFamily: 'monospace', color: isOffline ? 'text.disabled' : 'text.primary' }}>
              {topology.gatewayHealth?.panId}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary" display="block">Channel</Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ color: isOffline ? 'text.disabled' : 'text.primary' }}>
              {topology.gatewayHealth?.channel}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary" display="block">Uptime</Typography>
            <Typography variant="body2" fontWeight="bold" sx={{ color: isOffline ? 'text.disabled' : 'text.primary' }}>
              {isOffline ? 'N/A' : (topology.gatewayHealth?.uptime || '0h')}
            </Typography>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" color="text.secondary" display="block">Mesh Role</Typography>
            <Typography variant="body2" fontWeight="bold" color={isOffline ? 'text.disabled' : (isLeader ? 'warning.main' : 'primary.main')}>
              {isLeader ? '👑 Leader' : '📡 Router'}
            </Typography>
          </Grid>
        </Grid>

        <Box sx={{
          mt: 2,
          p: 1.25,
          bgcolor: alpha(theme.palette.background.default, 0.5),
          borderRadius: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>Directly Connected</Typography>
          <Box display="flex" alignItems="baseline" gap={0.5}>
            <Typography variant="h6" fontWeight="bold" color={isOffline ? 'text.disabled' : 'primary.main'} lineHeight={1}>
              {isOffline ? 0 : connectedCount}
            </Typography>
            <Typography variant="caption" color="text.secondary">nodes</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function BorderRouterCards({ topologyList }) {
  return (
    <>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Border Routers</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {topologyList && topologyList.length > 0 ? (
          topologyList.map((topology) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={topology.hardwareId || topology.id}>
              <BorderRouterCard topology={topology} />
            </Grid>
          ))
        ) : (
          <Grid size={{ xs: 12 }}>
            <Card sx={{ bgcolor: alpha('#ef4444', 0.1), border: '1px solid #ef4444' }}>
              <CardContent>
                <Typography variant="body2" color="error" textAlign="center">
                  No Border Routers currently reporting topology data.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </>
  );
}
