/**
 * StatCard — glassmorphic summary metric card.
 *
 * Used in the dashboard overview row for KPI metrics like
 * average temperature, active nodes, alert count, etc.
 */

import { Card, CardContent, Box, Typography, alpha } from '@mui/material';

export default function StatCard({ title, value, unit, icon, color = '#3B82F6', trend }) {
  return (
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: 140,
        borderTop: `2px solid ${alpha(color, 0.4)}`,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 30px -10px ${alpha(color, 0.3)}`,
        },
      }}
    >
      {/* Accent glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(color, 0.2)} 0%, transparent 70%)`,
        }}
      />

      <CardContent sx={{ position: 'relative', p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            {title}
          </Typography>
          <Box
            sx={{
              p: 1,
              borderRadius: 2.5,
              backgroundColor: alpha(color, 0.15),
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 16px ${alpha(color, 0.35)}`,
            }}
          >
            {icon}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          {parseFloat(value) <= -998.5 ? (
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: 'error.main', lineHeight: 1, letterSpacing: 1 }}
            >
              FAULT
            </Typography>
          ) : parseFloat(value) <= -997.5 ? (
            <Typography
              variant="h5"
              sx={{ fontWeight: 700, color: 'warning.main', lineHeight: 1, letterSpacing: 1 }}
            >
              WARMUP
            </Typography>
          ) : (
            <>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, fontFamily: '"JetBrains Mono", monospace', color: 'text.primary', lineHeight: 1 }}
              >
                {value}
              </Typography>
              {unit && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                  {unit}
                </Typography>
              )}
            </>
          )}
        </Box>

        {trend && (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mt: 1, display: 'block' }}
          >
            {trend}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
