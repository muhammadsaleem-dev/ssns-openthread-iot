import { Box, Typography, Chip, alpha } from '@mui/material';
import { Handle, Position } from '@xyflow/react';
import { formatExtAddr } from '../../utils/format';

export function RouterNode({ data }) {
  const isLeader = data.role?.toLowerCase() === 'leader';
  const roleLabel = isLeader ? 'LEADER' : 'ROUTER';
  const roleColor = isLeader ? '#F59E0B' : '#3B82F6';

  return (
    <Box sx={{
      background: alpha(roleColor, 0.1),
      border: `2px solid ${roleColor}`,
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#fff',
      minWidth: '160px',
      textAlign: 'center',
      boxShadow: `0 0 15px ${alpha(roleColor, 0.4)}`,
      position: 'relative'
    }}>
      <Chip
        label={roleLabel}
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '20px',
          fontSize: '0.6rem',
          fontWeight: 800,
          bgcolor: roleColor,
          color: '#000'
        }}
      />
      <Handle type="target" position={Position.Top} />

      <Typography variant="body1" fontWeight="bold" sx={{ mt: 1 }}>
        {isLeader ? '👑 ' : '📡 '}{data.label}
      </Typography>

      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block', fontSize: '0.55rem', fontFamily: 'monospace' }}>
          {formatExtAddr(data.extAddr)}
        </Typography>
        <Typography variant="caption" sx={{ color: roleColor, fontWeight: 600, fontSize: '0.7rem' }}>
          {data.rloc16}
        </Typography>
      </Box>

      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}

export function EndDeviceNode({ data }) {
  return (
    <Box sx={{
      background: alpha('#10B981', 0.1),
      border: '2px solid #10B981',
      borderRadius: '16px',
      padding: '8px 15px',
      color: '#fff',
      minWidth: '140px',
      textAlign: 'center',
      boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
      position: 'relative'
    }}>
      <Chip
        label="END DEVICE"
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '18px',
          fontSize: '0.55rem',
          fontWeight: 700,
          bgcolor: '#10B981',
          color: '#000'
        }}
      />
      <Handle type="target" position={Position.Top} />

      <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>
        🍃 {data.label}
      </Typography>

      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block', fontSize: '0.55rem', fontFamily: 'monospace' }}>
          {formatExtAddr(data.extAddr)}
        </Typography>
        <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600, fontSize: '0.65rem' }}>
          {data.rloc16}
        </Typography>
      </Box>
    </Box>
  );
}
