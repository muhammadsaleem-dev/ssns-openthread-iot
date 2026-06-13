import { Box, Typography, Grid, Card, CardContent, Chip } from '@mui/material';

const SENSORS = [
  { key: 'temperature', label: 'Temperature', unit: '°C', precision: 1 },
  { key: 'humidity', label: 'Humidity', unit: '%', precision: 1 },
  { key: 'co2', label: 'CO2', unit: 'ppm', precision: 0 },
  { key: 'tvoc', label: 'TVOC', unit: 'ppb', precision: 0 },
  { key: 'eco2', label: 'eCO2', unit: 'ppm', precision: 0 },
  { key: 'pm1_0', label: 'PM 1.0', unit: 'µg/m³', precision: 1 },
  { key: 'pm2_5', label: 'PM 2.5', unit: 'µg/m³', precision: 1 },
  { key: 'pm4_0', label: 'PM 4.0', unit: 'µg/m³', precision: 1 },
  { key: 'pm10', label: 'PM 10', unit: 'µg/m³', precision: 1 },
];

function getStability(std) {
  if (!std || std < 0) return { label: 'Calc', color: 'default' };
  if (std < 1.0) return { label: 'Stable', color: 'success' };
  if (std < 3.0) return { label: 'Moderate', color: 'warning' };
  return { label: 'Unstable', color: 'error' };
}

export default function StatisticsTab({ data }) {
  if (!data) return null;

  return (
    <Box sx={{ mt: 2, mb: 4 }}>
      <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold' }}>
        Telemetry Statistics (3min Rolling Window)
      </Typography>
      <Grid container spacing={2}>
        {SENSORS.map((sensor) => {
          const current = data[sensor.key];
          const mean = data[`${sensor.key}Mean`];
          const std = data[`${sensor.key}Std`];
          const max = data[`${sensor.key}Max`];
          
          if (current == null) return null;

          const stability = getStability(std);

          return (
            <Grid item xs={12} sm={6} key={sensor.key}>
              <Card variant="outlined">
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">
                      {sensor.label}
                    </Typography>
                    <Chip label={stability.label} color={stability.color} size="small" />
                  </Box>
                  
                  <Typography variant="h5" sx={{ mb: 1.5 }}>
                    {current > -998 ? current.toFixed(sensor.precision) : 'FAULT'} {sensor.unit}
                  </Typography>

                  <Grid container spacing={1}>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Mean</Typography>
                      <Typography variant="body2">{mean?.toFixed(sensor.precision) || '--'}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Std Dev</Typography>
                      <Typography variant="body2">{std?.toFixed(sensor.precision + 1) || '--'}</Typography>
                    </Grid>
                    <Grid item xs={4}>
                      <Typography variant="caption" color="text.secondary">Max</Typography>
                      <Typography variant="body2">{max?.toFixed(sensor.precision) || '--'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
