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
      }}
    >
      {/* Accent glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(color, 0.15)} 0%, transparent 70%)`,
        }}
      />

      <CardContent sx={{ position: 'relative', p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ color: 'text.secondary', fontSize: '0.8rem', fontWeight: 500 }}>
            {title}
          </Typography>
          <Box
            sx={{
              p: 0.8,
              borderRadius: 2,
              backgroundColor: alpha(color, 0.1),
              color: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1 }}
          >
            {value}
          </Typography>
          {unit && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {unit}
            </Typography>
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
