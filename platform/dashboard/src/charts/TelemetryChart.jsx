/**
 * TelemetryChart — reusable Recharts area/line chart for environmental telemetry.
 *
 * Renders a responsive, animated chart with gradient fill.
 * Used for temperature, light intensity, and AQI trend visualisation.
 */

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, Typography, Box, alpha } from '@mui/material';
import { formatTime } from '../utils/format';

const CustomTooltip = ({ active, payload, label, unit, valueLabel }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Box
      sx={{
        bgcolor: '#1E293B',
        border: '1px solid rgba(148,163,184,0.15)',
        borderRadius: 1.5,
        px: 1.5,
        py: 1,
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
        {formatTime(label)}
      </Typography>
      {payload.map((entry, index) => (
        <Typography key={index} variant="body2" sx={{ color: entry.color || '#3B82F6', fontWeight: 600 }}>
          {entry.name || valueLabel}: {entry.value?.toFixed(1)} {unit}
        </Typography>
      ))}
    </Box>
  );
};

export default function TelemetryChart({
  title,
  data,
  dataKey,
  series,
  color = '#3B82F6',
  unit = '',
  valueLabel = 'Value',
  height = 250,
}) {
  const commonProps = {
    data,
    margin: { top: 5, right: 10, left: -15, bottom: 0 }
  };

  return (
    <Card>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 2, fontWeight: 500 }}>
          {title}
        </Typography>

        <ResponsiveContainer width="100%" height={height}>
          {series && series.length > 0 ? (
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip unit={unit} valueLabel={valueLabel} />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              {series.map(s => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.name}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: s.color, fill: '#0B1120' }}
                  connectNulls={true}
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip unit={unit} valueLabel={valueLabel} />} />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${dataKey})`}
                animationDuration={600}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: color, fill: '#0B1120' }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
