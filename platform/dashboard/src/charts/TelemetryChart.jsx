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
  ReferenceLine,
} from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { formatTime } from '../utils/format';

const CustomTooltip = ({ active, payload, label, unit, valueLabel }) => {
  const theme = useTheme();
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
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
  threshold,
  minThreshold,
}) {
  const commonProps = {
    data,
    margin: { top: 15, right: 10, left: 0, bottom: 0 }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="subtitle2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {minThreshold && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, border: '1px solid rgba(148,163,184,0.2)', px: 1, py: 0.25, borderRadius: 1 }}>
                Min: {minThreshold}{unit ? ` ${unit}` : ''}
              </Typography>
            )}
            {threshold && (
              <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 500, border: '1px solid rgba(148,163,184,0.2)', px: 1, py: 0.25, borderRadius: 1 }}>
                Max: {threshold}{unit ? ` ${unit}` : ''}
              </Typography>
            )}
          </Box>
        </Box>

        {(!data || data.length === 0) ? (
          <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(148,163,184,0.2)', borderRadius: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No recent telemetry data
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {series && series.length > 0 ? (
              <LineChart {...commonProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
                <XAxis dataKey="timestamp" type="number" domain={['dataMin', 'dataMax']} tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false} />
                <YAxis domain={['dataMin', 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip unit={unit} valueLabel={valueLabel} />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                {threshold && <ReferenceLine y={threshold} stroke="#EF4444" strokeDasharray="8 4" strokeOpacity={0.7} strokeWidth={2} label={{ position: 'insideTopLeft', value: 'Max', fill: '#EF4444', fontSize: 10, fontWeight: 600 }} />}
                {minThreshold && <ReferenceLine y={minThreshold} stroke="#EF4444" strokeDasharray="8 4" strokeOpacity={0.7} strokeWidth={2} label={{ position: 'insideBottomLeft', value: 'Min', fill: '#EF4444', fontSize: 10, fontWeight: 600 }} />}
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
                <YAxis domain={['dataMin', 'auto']} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip unit={unit} valueLabel={valueLabel} />} />
                {threshold && <ReferenceLine y={threshold} stroke="#EF4444" strokeDasharray="8 4" strokeOpacity={0.7} strokeWidth={2} label={{ position: 'insideTopLeft', value: 'Max', fill: '#EF4444', fontSize: 10, fontWeight: 600 }} />}
                {minThreshold && <ReferenceLine y={minThreshold} stroke="#EF4444" strokeDasharray="8 4" strokeOpacity={0.7} strokeWidth={2} label={{ position: 'insideBottomLeft', value: 'Min', fill: '#EF4444', fontSize: 10, fontWeight: 600 }} />}
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
        )}
      </CardContent>
    </Card>
  );
}
