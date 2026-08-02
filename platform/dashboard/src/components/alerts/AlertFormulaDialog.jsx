import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Typography, Box, IconButton, Tooltip, Chip, useTheme, alpha 
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CloseIcon from '@mui/icons-material/Close';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import FunctionsIcon from '@mui/icons-material/Functions';
import ScienceIcon from '@mui/icons-material/Science';

const FORMULA_METADATA = {
  HIGH_CO2: {
    title: 'Carbon Dioxide (CO2) High Stuffiness Alarm',
    standard: 'ASHRAE Standard 62.1 (Indoor Air Quality & Ventilation)',
    formula: 'Current CO2 > 1500.0 ppm AND Rolling Average > 1200.0 ppm AND CO2 Variance < 150.0 ppm',
    noiseFloor: 'Hardware Noise Floor Clamped at 100.0 ppm (Sensirion SCD41 Datasheet: ±40 ppm + 5%)',
    explanation: 'Evaluates instantaneous room stuffiness against fixed ASHRAE 62.1 health limits while validating 3-minute rolling stability (Variance < 150 ppm). This dual check guarantees the alert represents true sustained room stuffiness and automatically filters out brief transient breath exhalations (Rule 1 Breath Check).'
  },
  TEMPERATURE_HIGH: {
    title: 'Temperature High (HVAC Overheating Alarm)',
    standard: 'ASHRAE Standard 55 (Thermal Environmental Conditions for Human Occupancy)',
    formula: 'Current Temperature > 35.0 °C',
    noiseFloor: 'Hardware Drift Tolerance: ±0.2 °C (Sensirion SCD41/SHT Datasheet)',
    explanation: 'Triggers an immediate thermal warning via Engine 1 Life Safety checks when ambient room temperature exceeds the upper human thermal comfort limit (35.0 °C). Protects occupants from heat stress and indicates potential HVAC cooling failure.'
  },
  TEMPERATURE_LOW: {
    title: 'Temperature Low (Cold & Pipe Freeze Emergency)',
    standard: 'ASHRAE Standard 55 & Building Pipe Freeze Protection Guidelines',
    formula: 'Current Temperature < 10.0 °C',
    noiseFloor: 'Hardware Drift Tolerance: ±0.2 °C (Sensirion SCD41/SHT Datasheet)',
    explanation: 'Protects building infrastructure against freezing water pipes while preventing severe cold strain on occupants. If correlated with a simultaneous CO2 drop, Engine 2 diagnoses the exact cause as an open exterior window during winter (Rule 3 Winter Draft).'
  },
  HUMIDITY_HIGH: {
    title: 'Humidity High (Mold & Condensation Risk Alarm)',
    standard: 'ASHRAE Standard 55 (Thermal Environmental Conditions for Human Occupancy)',
    formula: 'Current Humidity > 70.0 %RH',
    noiseFloor: 'Hardware Drift Tolerance: ±3% RH (Sensirion SCD41 Datasheet)',
    explanation: 'Triggers an immediate warning via Engine 1 Life Safety checks when relative humidity exceeds the upper comfort/condensation-risk limit (70% RH). Sustained high humidity promotes mold growth and structural condensation damage.'
  },
  HUMIDITY_LOW: {
    title: 'Humidity Low (Dry Air & Static Discomfort Warning)',
    standard: 'ASHRAE Standard 55 (Thermal Environmental Conditions for Human Occupancy)',
    formula: 'Current Humidity < 20.0 %RH',
    noiseFloor: 'Hardware Drift Tolerance: ±3% RH (Sensirion SCD41 Datasheet)',
    explanation: 'Flags excessively dry indoor air (below 20% RH), which can cause respiratory irritation, increased static electricity risk, and accelerated deterioration of sensitive materials.'
  },
  HIGH_PARTICULATES: {
    title: 'PM2.5 Particulate (Active Fire / Smoke Warning)',
    standard: 'WHO (World Health Organization) & EPA Air Quality Standards',
    formula: 'Current PM2.5 > 35.0 µg/m³ AND Current TVOC > 1000.0 ppb AND Temperature > Rolling Mean + (2.0 * Temp Variance)',
    noiseFloor: 'Hardware Noise Floor Clamped at 5.0 µg/m³ (Sensirion SPS30 Optical Particle Counter Spec)',
    explanation: 'Engine 1 monitors raw particulate levels against WHO 24-hour exposure limits (> 35 µg/m³). Meanwhile, Engine 2 cross-correlates particulate soot with chemical hydrocarbon gases (TVOC > 1000 ppb) and thermal heat rise (+2 Sigma) to instantly confirm active building combustion (Rule 8 Fire Alarm) without false alarming on floor sweeping (Rule 5 Dust Check).'
  },
  HIGH_VOC: {
    title: 'Total VOCs (Persistent Chemical Spill / Gas Hazard)',
    standard: 'WELL v2 Building Standard (Feature A01: Fundamental Air Quality)',
    formula: 'Current TVOC > 1000.0 ppb AND Rolling Average > 800.0 ppb AND TVOC Variance < 100.0 ppb',
    noiseFloor: 'Hardware Noise Floor Clamped at 25.0 ppb (ScioSense CCS811 / SGP30 Baseline Spec)',
    explanation: 'Detects sustained chemical gas accumulation (cleaning supplies, off-gassing, paints) exceeding WELL v2 healthy indoor air thresholds (1,000 ppb). Enforces low standard deviation (< 100 ppb) over the 3-minute window to distinguish sustained spills from quick lighter flicks or perfume sprays (Rule 7 Check).'
  },
  TRANSIENT_CO2_SPIKE: {
    title: 'Rule 1 — Human Breath (Transient CO2 Event)',
    standard: 'Engineering Basis: Statistical Anomaly Detection & Sensirion SCD41 Sensor Specifications',
    engine: 'Engine 2 — Statistical Heuristics & Rolling Window Algorithm',
    formula: 'CO2 Peak > Rolling Average + MAX ( 2 * CO2 Standard Deviation , 100 ppm Hardware Noise Floor ) AND CO2 Reading returns toward Rolling Average within 3 minutes',
    noiseFloor: 'Hardware Noise Floor Clamped at 100.0 ppm per Sensirion SCD41 Datasheet ±40 ppm + 5% accuracy',
    explanation: 'Direct human breath (~38,000 ppm CO2) near the sensor causes a sudden localized spike > 2 Standard Deviations. Because room-wide CO2 concentration changes gradually across the monitored space, a sharp localized spike that recovers within the configured 3-minute observation window is statistically classified by Engine 2 as a transient human-breath event.'
  },
  VENTILATION_EVENT: {
    title: 'Rule 2 — Window Opened (Simultaneous Draft & Gas Dilution)',
    standard: 'Engineering Basis: Multi-Sensor Correlation Heuristics (2-Sigma Rolling Window) & ASHRAE Standard 55 Thermal Draft Principles',
    engine: 'Engine 2 — Statistical Heuristics & Cross-Sensor Correlation',
    formula: 'Temperature < Rolling Average - (2 * Temperature Standard Deviation) AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)',
    noiseFloor: 'Thermal Floor: ±0.2 °C | CO2 Floor: 100 ppm per Sensirion SCD41 Datasheet',
    explanation: 'Opening an exterior window causes rapid outdoor air dilution and an immediate thermal draft. Engine 2 correlates simultaneous 2-sigma drops in temperature and CO2 to confirm natural window ventilation rather than an HVAC heating failure.'
  },
  FREEZING_WINTER_WINDOW: {
    title: 'Rule 3 — Freezing Winter Window (< 10 °C Emergency Draft)',
    standard: 'Engineering Basis: Building Freeze Protection Heuristics (< 10 °C Absolute Threshold) & Multi-Sensor CO2 Correlation',
    engine: 'Engine 1 (Absolute Threshold) & Engine 2 (Correlation Check)',
    formula: 'Current Temperature < 10 C AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)',
    noiseFloor: 'Thermal Floor: ±0.2 °C | CO2 Floor: 100 ppm per Sensirion SCD41 Datasheet',
    explanation: 'To prevent indoor water pipes from freezing below 10 °C (50 °F), Engine 1 triggers a life-safety thermal warning when sub-zero temperatures coincide with a 2-sigma CO2 drop confirming an open exterior window.'
  },
  MOISTURE_EVENT: {
    title: 'Rule 4 — Hot Tea vs Human Breath (Moisture Event Without Exhalation)',
    standard: 'Engineering Basis: Sensirion Multi-Sensor Application Guidelines (SCD4x & SHT4x Cross-Correlation) & Statistical Variance Filtering',
    engine: 'Engine 2 — Statistical Heuristics & Multi-Sensor Variance Check',
    formula: 'Humidity Peak > Rolling Average + MAX ( 3 * Humidity Standard Deviation , 5 %RH Sensor Floor ) AND CO2 Variance remains flat (< 10 ppm)',
    noiseFloor: 'Clamped at 5.0 %RH per Sensirion SCD41 / SHT Datasheet',
    explanation: 'Hot beverage steam and human breath both cause a sharp jump in relative humidity (> 3 Sigma). Engine 2 confirms a non-exhalation moisture event (like hot tea) by verifying that simultaneous CO2 variance remains flat under 10 ppm.'
  },
  PARTICULATE_EVENT: {
    title: 'Rule 5 — Dust Sweeping vs Fire Hazard (Physical Particulate Disturbance)',
    standard: 'Engineering Basis: Multi-Sensor Fire & Combustion Exclusion Heuristics (Optical PM2.5 vs Thermal & Gas Variance)',
    engine: 'Engine 2 — Statistical Heuristics & Combustion Exclusion Check',
    formula: 'PM2.5 Peak > Rolling Average + MAX ( 3 * PM2.5 Standard Deviation , 5 µg/m³ Particle Floor ) AND Gas & Temp remain flat',
    noiseFloor: 'Clamped at 5.0 µg/m³ per Sensirion SPS30 Optical Particle Counter Spec',
    explanation: 'Physical activities like sweeping dust or vacuuming cause sharp spikes in PM2.5 particle counts (> 3 Sigma). Engine 2 verifies that chemical TVOC and temperature remain flat before classifying the spike as benign physical dust rather than active fire.'
  },
  OCCUPANCY_EVENT: {
    title: 'Rule 6 — Camera-Free Occupancy Detection (Conference Room Occupancy)',
    standard: 'Engineering Basis: Indoor CO2 Mass-Balance Principles & Statistical Variance Stability (< 50 ppm σ)',
    engine: 'Engine 2 — Statistical Heuristics & Stable Variance Algorithm',
    formula: 'CO2 Rolling Average > Occupancy Threshold (Default: 800 ppm) AND CO2 Standard Deviation < 50 ppm',
    noiseFloor: 'Configured occupancy threshold: 800 ppm (default); Stable variance criterion: σ < 50 ppm.',
    explanation: 'Outdoor CO2 is typically around 420–450 ppm under normal ambient conditions. Continuous human respiration gradually increases indoor CO2 concentration in enclosed spaces. When the rolling average exceeds the configured occupancy threshold (default: 800 ppm, which can be adjusted for different building ventilation characteristics) while statistical variance remains low (σ < 50 ppm), Engine 2 statistically infers sustained occupancy rather than a transient CO2 event.'
  },
  TRANSIENT_VOC_EVENT: {
    title: 'Rule 7 — Deodorant Spray / Hand Sanitizer (Transient Chemical Burst)',
    standard: 'Engineering Basis: Metal-Oxide Semiconductor (MOS) VOC Sensor Characteristics & Statistical Transient Detection',
    engine: 'Engine 2 — Statistical Heuristics & Anomaly Suppression Pipeline',
    formula: 'TVOC Peak > Rolling Average + MAX ( 1.5 * TVOC Standard Deviation , 25 ppb Metal-Oxide Floor ) AND Particulate < 35 µg/m³',
    noiseFloor: 'Clamped at 25.0 ppb per ScioSense CCS811 / SGP30 Baseline Spec',
    explanation: 'Short-lived chemical bursts from hand sanitizer, perfume, or deodorant spray cause rapid TVOC jumps (> 1.5 Sigma). Because localized chemical aerosols disperse quickly and produce no combustion soot (< 35 µg/m³ PM2.5), Engine 2 logs a harmless chemical burst.'
  },
  COMBUSTION_WARNING: {
    title: 'Rule 8 — Critical Combustion (Active Building Fire: Soot + Gas + Heat)',
    standard: 'Engineering Basis: Multi-Criteria Combustion Detection Principles (Simultaneous Particulate, Gas, and Heat Rise)',
    engine: 'Engine 1 (Critical Limits) & Engine 2 (Multi-Sensor Correlation)',
    formula: 'Current PM2.5 > 35 ug/m3 AND Current TVOC > 1000 ppb AND Temperature > Rolling Average + (2 * Temperature Standard Deviation)',
    noiseFloor: 'PM2.5: > 35 µg/m³ | TVOC: > 1000 ppb | Temp Jump: > 2.0 Sigma',
    explanation: 'Active building combustion generates a distinct triple-sensor breach: toxic particulate soot (> 35 µg/m³ PM2.5), chemical gases (> 1,000 ppb TVOC), and rapid thermal heat rise (+2 Sigma). Engine 2 requires simultaneous breach of all three parameters to trigger emergency fire alarms.'
  },
  AIR_QUALITY_POOR: {
    title: 'Composite Air Quality Index & Multi-Sensor Degradation',
    standard: 'Engineering Basis: Multi-Parameter Environmental Quality Thresholds (3-Minute Sustained Rolling Window)',
    engine: 'Engine 1 — Absolute Threshold Evaluation Engine',
    formula: 'CO2 > 1500 ppm OR PM2.5 > 35 ug/m3 OR TVOC > 1000 ppb over 3-Minute Window',
    noiseFloor: 'Enforces multi-parameter baseline floors across SCD41, SPS30, and CCS811',
    explanation: 'To prevent false alarms from temporary sensor spikes, Engine 1 classifies indoor air quality as degraded only when CO2 (> 1,500 ppm), PM2.5 (> 35 µg/m³), or TVOC (> 1,000 ppb) remains breached continuously throughout a 3-minute rolling window.'
  },
  HARDWARE_FAULT: {
    title: 'Sensor Hardware Fault & I2C Bus Disconnection (-999)',
    standard: 'Engineering Basis: IETF CoAP & I2C Digital Bus Communication Specifications (Sentinel Fault & CRC Error Detection)',
    engine: 'Engine 1 — Hardware Diagnostic & Sentinel Protection Pipeline',
    formula: 'Raw Sensor Reading == -999.0 OR CRC Checksum Error',
    noiseFloor: 'Fault sentinel threshold: -999.0',
    explanation: 'Digital I2C sensors return error code -999.0 or CRC checksum failures during wiring disconnects or hardware faults. Engine 1 intercepts these sentinel values immediately to isolate hardware faults and keep rolling averages clean.'
  },
  ML_ANOMALY: {
    title: 'Multi-Variable Behavioral Anomaly Detection',
    standard: 'Engineering Basis: Statistical Outlier Detection (Z-Score Rolling Thresholds & scikit-learn IsolationForest)',
    engine: 'Engine 2 (Rolling Z-Scores) & Engine 3 (scikit-learn IsolationForest)',
    formula: 'Peak Reading > Rolling Average + MAX ( Z * Standard Deviation , Datasheet Hardware Noise Floor )',
    noiseFloor: 'Multipliers: Z = 2.0 (95.4% Confidence for CO2/Drafts) | Z = 3.0 (99.7% Confidence for PM/Humidity)',
    explanation: 'Engine 2 identifies statistical anomalies using rolling Z-Score thresholds (Z = 2.0 or 3.0 Standard Deviations above baseline). To prevent false triggers in quiet rooms, standard deviation is clamped to minimum hardware datasheet limits.'
  },
  FORECAST_WARNING: {
    title: 'Predictive AI Trend & Forecast Warning',
    standard: 'Engineering Basis: Linear Rate-of-Rise Derivative Extrapolation (Predictive Trend Algorithm)',
    engine: 'Engine 3 — Machine Learning & Linear Trend Engine',
    formula: 'Projected Value (t + 15m) = Current Reading + (Rolling Slope * 15m) > Threshold Limit',
    noiseFloor: 'Evaluated across 180-second rolling derivative window',
    explanation: 'Engine 3 computes the real-time rate-of-rise slope across a 180-second rolling window using linear regression. By extrapolating this slope 15 minutes ahead, the system warns facility managers before rapidly climbing parameters breach safety limits.'
  },
  NODE_OFFLINE: {
    title: 'nRF52840 Sensor Node Heartbeat & Connection Timeout',
    standard: 'Engineering Basis: CoAP UDP Keep-Alive Heartbeat Specification & Edge Mesh Timeout Detection',
    engine: 'Engine 1 — Edge Network & Gateway Diagnostic Pipeline',
    formula: 'Current Server Timestamp - Last Heartbeat Timestamp > 60.0 seconds',
    noiseFloor: 'Debounce timeout buffer: 60.0 seconds',
    explanation: 'Wireless IoT sensors periodically transmit UDP keep-alive heartbeats to the gateway. If no packet arrives for over 60.0 seconds, Engine 1 flags the node as offline due to battery exhaustion or wireless mesh interference.'
  }
};

export function ExplainFormulaButton({ alert, size = 'small' }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!alert) return null;

  let typeKey = alert.type || 'ML_ANOMALY';
  
  // Intelligent matching for transient heuristic events based on context or message
  const textCheck = `${alert.type || ''} ${alert.context || ''} ${alert.message || ''}`.toLowerCase();
  if (textCheck.includes('breath') || textCheck.includes('exhalation') || textCheck.includes('transient co2')) {
    typeKey = 'TRANSIENT_CO2_SPIKE';
  } else if (textCheck.includes('window') || textCheck.includes('ventilation') || textCheck.includes('draft')) {
    if (textCheck.includes('winter') || textCheck.includes('freezing') || textCheck.includes('sub-zero') || textCheck.includes('< 10')) {
      typeKey = 'FREEZING_WINTER_WINDOW';
    } else {
      typeKey = 'VENTILATION_EVENT';
    }
  } else if (textCheck.includes('tea') || textCheck.includes('moisture') || textCheck.includes('steam') || textCheck.includes('water vapor')) {
    typeKey = 'MOISTURE_EVENT';
  } else if (textCheck.includes('sweeping') || textCheck.includes('dust') || textCheck.includes('janitor') || textCheck.includes('particulate event')) {
    typeKey = 'PARTICULATE_EVENT';
  } else if (textCheck.includes('occupancy') || textCheck.includes('conference') || textCheck.includes('people sitting')) {
    typeKey = 'OCCUPANCY_EVENT';
  } else if (textCheck.includes('lighter') || textCheck.includes('perfume') || textCheck.includes('deodorant') || textCheck.includes('transient voc')) {
    typeKey = 'TRANSIENT_VOC_EVENT';
  } else if (textCheck.includes('combustion') || textCheck.includes('fire') || textCheck.includes('smoke')) {
    typeKey = 'COMBUSTION_WARNING';
  }

  const meta = FORMULA_METADATA[typeKey] || FORMULA_METADATA.ML_ANOMALY;

  return (
    <>
      <Tooltip title="Click to view exact mathematical formula, thresholds & ASHRAE/WHO standards">
        <IconButton
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          sx={{
            color: isDark ? '#FBBF24' : '#D97706',
            bgcolor: isDark ? alpha('#FBBF24', 0.12) : alpha('#F59E0B', 0.1),
            border: `1px solid ${isDark ? alpha('#FBBF24', 0.3) : alpha('#F59E0B', 0.3)}`,
            '&:hover': {
              bgcolor: isDark ? alpha('#FBBF24', 0.25) : alpha('#F59E0B', 0.2),
              transform: 'scale(1.08)'
            },
            transition: 'all 0.15s ease',
            p: 0.6,
            ml: 0.5
          }}
        >
          <LightbulbIcon sx={{ fontSize: size === 'small' ? 16 : 18 }} />
        </IconButton>
      </Tooltip>

      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            border: `1px solid ${theme.palette.divider}`
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? alpha('#1E293B', 0.6) : alpha('#F8FAFC', 0.8)
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box sx={{ 
              p: 1, borderRadius: 2, bgcolor: isDark ? alpha('#FBBF24', 0.15) : alpha('#F59E0B', 0.15),
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}>
              <LightbulbIcon sx={{ color: isDark ? '#FBBF24' : '#D97706', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
                {meta.title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                {meta.engine || 'Engine 2 — Statistical Heuristics & Rolling Window Algorithm'} • {alert.type || 'Custom Alert'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 3, px: 3 }}>
          {/* Standard Reference Chip Box */}
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <MenuBookIcon sx={{ fontSize: 18, color: 'primary.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                Engineering Basis & Reference
              </Typography>
            </Box>
            <Box sx={{ 
              p: 1.2, borderRadius: 1.5, 
              bgcolor: isDark ? alpha('#3B82F6', 0.1) : alpha('#3B82F6', 0.08),
              borderLeft: `4px solid ${theme.palette.primary.main}`
            }}>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: isDark ? '#93C5FD' : '#1D4ED8' }}>
                {meta.standard}
              </Typography>
            </Box>
          </Box>

          {/* Mathematical Formula Box */}
          <Box sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <FunctionsIcon sx={{ fontSize: 18, color: 'warning.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                Exact Mathematical Trigger Formula
              </Typography>
            </Box>
            <Box sx={{ 
              p: 1.5, borderRadius: 2, 
              bgcolor: isDark ? '#0F172A' : '#1E293B',
              color: '#F8FAFC',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: `1px solid ${isDark ? '#334155' : '#475569'}`,
              overflowX: 'auto',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {meta.formula}
            </Box>
            {meta.noiseFloor && (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.6, fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <span>🛡️</span> {meta.noiseFloor}
              </Typography>
            )}
          </Box>

          {/* Physical Meaning & Engineering Explanation */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.8 }}>
              <ScienceIcon sx={{ fontSize: 18, color: 'success.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                Physical & Engineering Justification (Why Did This Trigger?)
              </Typography>
            </Box>
            <Box sx={{ 
              p: 1.8, borderRadius: 2, 
              bgcolor: isDark ? alpha('#10B981', 0.08) : alpha('#10B981', 0.06),
              border: `1px solid ${isDark ? alpha('#10B981', 0.25) : alpha('#10B981', 0.2)}`
            }}>
              <Typography sx={{ fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.6 }}>
                {meta.explanation}
              </Typography>
              
              {alert.triggerValue != null && alert.triggerValue !== -999 && (
                <Box sx={{ mt: 1.5, pt: 1.2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2.5 }}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      Measured Reading: <strong style={{ color: theme.palette.error.main }}>{alert.triggerValue.toFixed(1)}</strong>
                    </Typography>
                    {alert.thresholdValue != null && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                          Threshold Limit: <strong>{alert.thresholdValue.toFixed(1)}</strong>
                        </Typography>
                        <Chip 
                          label={
                            typeKey.includes('OCCUPANCY')
                              ? 'Configured Occupancy Threshold (Default: 800 ppm)'
                              : typeKey.includes('TRANSIENT') || typeKey.includes('VENTILATION') || typeKey.includes('MOISTURE') || typeKey.includes('PARTICULATE') || typeKey.includes('ML_ANOMALY')
                              ? 'Dynamic 2σ / 3σ Limit (Rolling Average + Clamped Noise Floor)'
                              : 'Configured Detection Threshold'
                          } 
                          size="small" 
                          sx={{ 
                            height: 20, 
                            fontSize: '0.68rem', 
                            fontWeight: 600, 
                            bgcolor: isDark ? alpha('#3B82F6', 0.15) : alpha('#3B82F6', 0.1), 
                            color: isDark ? '#60A5FA' : '#2563EB' 
                          }} 
                        />
                      </Box>
                    )}
                  </Box>
                  {(typeKey.includes('TRANSIENT') || typeKey.includes('VENTILATION') || typeKey.includes('MOISTURE') || typeKey.includes('PARTICULATE') || typeKey.includes('ML_ANOMALY')) && alert.thresholdValue != null && (
                    <Typography sx={{ fontSize: '0.75rem', color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', fontStyle: 'italic', mt: 0.6 }}>
                      ℹ️ Note: This threshold ({alert.thresholdValue.toFixed(1)}) is automatically computed by Engine 2 every 3 minutes (Rolling Baseline + MAX(Z * σ, Hardware Floor)). Because the reading recovered toward the average within 180 seconds, Engine 2 classified it as a transient event without triggering a building alarm.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: isDark ? alpha('#1E293B', 0.4) : alpha('#F8FAFC', 0.8) }}>
          <Button onClick={() => setOpen(false)} variant="contained" size="small" sx={{ fontWeight: 600, px: 3 }}>
            Close Explanation
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
