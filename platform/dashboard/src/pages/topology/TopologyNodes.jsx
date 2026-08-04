import { Box, Typography, Chip, alpha } from '@mui/material';
import { Handle, Position } from '@xyflow/react';
import { keyframes } from '@mui/system';
import { formatExtAddr } from '../../utils/format';

const pulseAnimation = keyframes`
  0% { box-shadow: 0 0 0 0px rgba(255, 0, 0, 0.9), 0 0 20px 5px rgba(220, 38, 38, 0.8); }
  50% { box-shadow: 0 0 0 25px rgba(255, 0, 0, 0), 0 0 35px 15px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0px rgba(255, 0, 0, 0), 0 0 20px 5px rgba(220, 38, 38, 0.8); }
`;

export function RouterNode({ data }) {
  const isLeader = data.role?.toLowerCase() === 'leader';
  const isBorderRouter = data.isBorderRouter;
  const isGhost = data.isGhost;
  
  let roleLabel = isGhost ? 'GHOST ROUTER' : (isBorderRouter ? 'BORDER ROUTER' : (isLeader ? 'LEADER' : 'ROUTER'));
  let roleColor = isGhost ? '#6B7280' : (isBorderRouter ? '#8B5CF6' : (isLeader ? '#F59E0B' : '#3B82F6'));
  const opacity = isGhost ? 0.6 : 1;
  const icon = isGhost ? '👻' : (isBorderRouter ? '🌐' : (isLeader ? '👑' : '📡'));

  return (
    <Box sx={{
      background: roleColor,
      border: isLeader ? '2px solid #ef4444' : `2px solid ${alpha('#fff', 0.2)}`,
      borderRadius: '12px',
      padding: '10px 20px',
      color: '#fff',
      minWidth: '160px',
      textAlign: 'center',
      boxShadow: `0 4px 20px ${alpha(roleColor, 0.5)}`,
      position: 'relative',
      opacity,
      filter: isGhost ? 'grayscale(80%)' : 'none',
      animation: isLeader ? `${pulseAnimation} 2s infinite` : 'none'
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

      <Typography variant="body1" fontWeight="bold" sx={{ mt: 1, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        {icon} {data.label}
      </Typography>

      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.2)}` }}>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.8), display: 'block', fontSize: '0.55rem', fontFamily: 'monospace' }}>
          {formatExtAddr(data.extAddr)}
        </Typography>
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.7rem' }}>
          {data.rloc16}
        </Typography>
        {!isBorderRouter && (
          <Typography variant="caption" sx={{ color: alpha('#fff', 0.7), display: 'block', fontSize: '0.55rem', mt: 0.5 }}>
            Age: {data.age}s
          </Typography>
        )}
      </Box>

      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}

export function EndDeviceNode({ data }) {
  const isGhost = data.isGhost;
  const roleColor = isGhost ? '#6B7280' : '#10B981';
  const opacity = isGhost ? 0.6 : 1;

  return (
    <Box sx={{
      background: roleColor,
      border: `2px solid ${alpha('#fff', 0.2)}`,
      borderRadius: '50px', // Pill shape for End Devices
      padding: '8px 20px',
      color: '#fff',
      minWidth: '140px',
      textAlign: 'center',
      boxShadow: `0 4px 20px ${alpha(roleColor, 0.5)}`,
      position: 'relative',
      opacity,
      filter: isGhost ? 'grayscale(80%)' : 'none'
    }}>
      <Chip
        label={isGhost ? 'GHOST DEVICE' : 'END DEVICE'}
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '18px',
          fontSize: '0.55rem',
          fontWeight: 700,
          bgcolor: roleColor,
          color: '#000'
        }}
      />
      <Handle type="target" position={Position.Top} />

      <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5, textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>
        {isGhost ? '👻 ' : '💤 '}{data.label}
      </Typography>

      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.2)}` }}>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.8), display: 'block', fontSize: '0.55rem', fontFamily: 'monospace' }}>
          {formatExtAddr(data.extAddr)}
        </Typography>
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.65rem' }}>
          {data.rloc16}
        </Typography>
        <Typography variant="caption" sx={{ color: alpha('#fff', 0.7), display: 'block', fontSize: '0.55rem', mt: 0.5 }}>
          Age: {data.age}s / {data.timeout}s
        </Typography>
      </Box>
    </Box>
  );
}

export function CloudNode() {
  return (
    <Box sx={{
      background: 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
      border: `2px solid ${alpha('#fff', 0.5)}`,
      borderRadius: '24px',
      padding: '12px 30px',
      color: '#fff',
      minWidth: '180px',
      textAlign: 'center',
      boxShadow: '0 8px 32px rgba(14, 165, 233, 0.4)',
      position: 'relative',
    }}>
      <Chip
        label="INTERNET BACKBONE"
        size="small"
        sx={{
          position: 'absolute',
          top: -12,
          left: '50%',
          transform: 'translateX(-50%)',
          height: '20px',
          fontSize: '0.6rem',
          fontWeight: 800,
          bgcolor: '#fff',
          color: '#0ea5e9'
        }}
      />
      <Typography variant="body1" fontWeight="bold" sx={{ mt: 1, textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        ☁️ External IP Network
      </Typography>
      <Typography variant="caption" sx={{ color: alpha('#fff', 0.9), display: 'block', fontSize: '0.6rem', mt: 0.5 }}>
        Bridged via Thread Border Routers
      </Typography>
      
      {/* Cloud nodes only have source handles for layout purposes */}
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
}
