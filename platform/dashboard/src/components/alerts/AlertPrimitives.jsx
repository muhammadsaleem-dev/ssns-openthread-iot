import { TableCell, TableRow, Typography, Chip, Box, alpha, useTheme } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { formatTimestamp } from '../../utils/format';
import { SEVERITY_COLOR } from './alertConstants';

export const TH = ({ children, sx = {} }) => (
  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', whiteSpace: 'nowrap', ...sx }}>
    {children}
  </TableCell>
);

export const TD = ({ children, sx = {} }) => (
  <TableCell sx={{ fontSize: '0.8rem', verticalAlign: 'middle', ...sx }}>
    {children}
  </TableCell>
);

export const SeverityBadge = ({ severity }) => (
  <Chip label={severity} size="small" color={SEVERITY_COLOR[severity] || 'default'} sx={{ height: 22, minWidth: 72 }} />
);

export const NodeBadge = ({ nodeId, location }) => (
  <Chip label={location || nodeId} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
);

export const SeverityChip = ({ severity }) => (
  <TD><SeverityBadge severity={severity} /></TD>
);

export const NodeChip = ({ nodeId, location }) => (
  <TD><NodeBadge nodeId={nodeId} location={location} /></TD>
);

export const TimeCell = ({ ts }) => (
  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
    {formatTimestamp(ts)}
  </TableCell>
);

export const RecommendedAction = ({ action }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!action) return null;
  return (
    <Box sx={{ 
      display: 'flex', alignItems: 'flex-start', gap: 0.6, mt: 0.75, 
      bgcolor: isDark ? alpha('#FBBF24', 0.15) : alpha('#F59E0B', 0.1), 
      p: 0.75, borderRadius: 1, 
      border: `1px solid ${isDark ? alpha('#FBBF24', 0.3) : alpha('#F59E0B', 0.3)}` 
    }}>
      <LightbulbOutlinedIcon sx={{ fontSize: 16, color: isDark ? '#FCD34D' : '#D97706', mt: 0.1 }} />
      <Typography sx={{ fontSize: '0.75rem', color: isDark ? '#FDE68A' : '#92400E', fontWeight: 600, lineHeight: 1.3 }}>
        {action}
      </Typography>
    </Box>
  );
};

export const ROW_HOVER = { '&:last-child td': { borderBottom: 0 }, '&:hover': { bgcolor: alpha('#3B82F6', 0.04) } };

export const EmptyRow = ({ colSpan, label }) => (
  <TableRow>
    <TableCell colSpan={colSpan} align="center" sx={{ py: 6, color: 'text.secondary' }}>
      <WarningAmberIcon sx={{ fontSize: 32, mb: 1, display: 'block', mx: 'auto', color: 'text.secondary' }} />
      <Typography variant="body2">{label ?? 'No alerts'}</Typography>
    </TableCell>
  </TableRow>
);

export const formatAlertMessage = (a) => {
  if (a.type === 'NODE_OFFLINE') {
    return 'Connection lost. Sensor stopped responding.';
  }
  return a.message;
};
