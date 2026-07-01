import { Card, Box, Typography, Button, alpha, useTheme, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { SeverityBadge, NodeBadge, RecommendedAction, formatAlertMessage } from './AlertPrimitives';
import { formatTimestamp } from '../../utils/format';
import { OPERATIONAL_LABELS } from './alertConstants';

export default function MobileAlertCard({ a, nodeMap, onResolve, activeTab, isAdmin = true }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isAi = a.type && a.type.startsWith('AI_');
  const isInfra = a.type === 'NODE_OFFLINE';
  
  return (
    <Card sx={{ 
      mb: 2, 
      border: '1px solid', 
      borderColor: isDark ? alpha('#fff', 0.15) : alpha('#000', 0.12), 
      boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.05)',
      borderRadius: 2
    }}>
      <Box sx={{ p: 2 }}>
        {/* Top Header: Severity, Category, Time */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <SeverityBadge severity={a.severity} />
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isInfra ? 'Node Offline' : OPERATIONAL_LABELS[a.type] || a.type}
            </Typography>
          </Box>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0, textAlign: 'right' }}>
            {formatTimestamp(a.createdAt)}
          </Typography>
        </Box>
        
        {/* Node Chip */}
        <Box sx={{ mb: 1.5 }}>
          <NodeBadge nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
        </Box>

        {/* Message and Context */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: isAi && a.context ? 500 : 400 }}>
            {formatAlertMessage(a)}
          </Typography>
          {isAi && a.context && (
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5, fontStyle: 'italic' }}>
              {a.context}
            </Typography>
          )}
          <RecommendedAction action={a.recommendedAction} />
        </Box>

        {/* Data Values (Only for Operational and All tabs if not AI/Infra) */}
        {!isAi && !isInfra && a.triggerValue != null && (
          <Box sx={{ display: 'flex', gap: 3, mb: 2, p: 1.5, bgcolor: alpha('#888', 0.05), borderRadius: 1 }}>
            <Box>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, mb: 0.25 }}>Measured</Typography>
              <Typography sx={{ fontWeight: 700, color: 'error.light', fontSize: '0.9rem' }}>
                {a.triggerValue === -999 ? 'FAULT' : a.triggerValue.toFixed(1)}
              </Typography>
            </Box>
            {a.thresholdValue != null && a.triggerValue !== -999 && (
              <Box>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600, mb: 0.25 }}>Limit</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', fontWeight: 500 }}>
                  {a.thresholdValue.toFixed(1)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Action Button */}
        <Tooltip title={!isAdmin ? "Admin privileges required" : ""}>
          <span>
            <Button 
              fullWidth 
              variant={a.resolved ? "outlined" : "contained"} 
              color={a.resolved ? "inherit" : "primary"}
              disabled={!isAdmin || a.resolved} 
              onClick={() => onResolve(a.id)}
              startIcon={a.resolved ? <CheckIcon /> : null}
              sx={{ textTransform: 'none', fontWeight: 600, py: 1 }}
            >
              {a.resolved ? 'Resolved' : 'Mark as Resolved'}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Card>
  );
}

