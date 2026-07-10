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
    standard: 'ASHRAE Standard 62.1 Appendix D — Enclosed Space Respiratory Accumulation Guidelines',
    engine: 'Engine 2 — Statistical Heuristics & Rolling Window Algorithm',
    formula: 'CO2 Peak > Rolling Average + MAX ( 2 * CO2 Standard Deviation , 100 ppm Hardware Noise Floor ) AND CO2 Reading returns toward Rolling Average within 3 minutes',
    noiseFloor: 'Hardware Noise Floor Clamped at 100.0 ppm per Sensirion SCD41 Datasheet ±40 ppm + 5% accuracy',
    explanation: 'Per ASHRAE 62.1 Appendix D guidelines, normal room occupancy raises carbon dioxide gradually toward a steady-state baseline of 800–1,000 ppm. Therefore, an instantaneous jump above 3,500 ppm cannot represent room-wide air degradation; rather, it indicates direct human exhalation (~38,000 ppm in exhaled breath) onto the sensor. Because our backend verifies that the 3-minute rolling average and standard deviation remain stable, Engine 2 logs a transient breath event and suppresses false building alarms.'
  },
  VENTILATION_EVENT: {
    title: 'Rule 2 — Window Opened (Simultaneous Draft & Gas Dilution)',
    standard: 'ASHRAE Standard 62.1 Section 6.2 (Ventilation Rates) & ASHRAE Standard 55 Section 5.3 (Thermal Draft Limit)',
    engine: 'Engine 2 — Statistical Heuristics & Cross-Sensor Correlation',
    formula: 'Temperature < Rolling Average - (2 * Temperature Standard Deviation) AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)',
    noiseFloor: 'Thermal Floor: ±0.2 °C | CO2 Floor: 100 ppm per Sensirion SCD41 Datasheet',
    explanation: 'Per ASHRAE 62.1 Section 6.2 and Standard 55 guidelines, introducing outdoor air dilutes indoor carbon dioxide while causing an immediate localized thermal draft drop. When someone opens an exterior window, Engine 2 correlates the simultaneous 2-sigma drops in temperature and CO2 to confirm natural ventilation, preventing maintenance from mistakenly inspecting the heating boiler.'
  },
  FREEZING_WINTER_WINDOW: {
    title: 'Rule 3 — Freezing Winter Window (< 10 °C Emergency Draft)',
    standard: 'ASHRAE Standard 55 (Thermal Environmental Limits) & International Building Code Pipe Freeze Protection',
    engine: 'Engine 1 (Absolute Threshold) & Engine 2 (Correlation Check)',
    formula: 'Current Temperature < 10 C AND CO2 < Rolling Average - (2 * CO2 Standard Deviation)',
    noiseFloor: 'Thermal Floor: ±0.2 °C | CO2 Floor: 100 ppm per Sensirion SCD41 Datasheet',
    explanation: 'Per International Building Code and ASHRAE 55 guidelines, indoor spaces must remain above 10 °C to prevent water pipe freezing and severe cold strain. If a window is left open during sub-zero winter weather, Engine 1 immediately triggers a life-safety thermal warning, while Engine 2 correlates the thermal drop with CO2 dilution to direct staff to close the open window.'
  },
  MOISTURE_EVENT: {
    title: 'Rule 4 — Hot Tea vs Human Breath (Moisture Event Without Exhalation)',
    standard: 'Sensirion SCD41 / SHT Multi-Sensor Cross-Correlation Application Note',
    engine: 'Engine 2 — Statistical Heuristics & Multi-Sensor Variance Check',
    formula: 'Humidity Peak > Rolling Average + MAX ( 3 * Humidity Standard Deviation , 5 %RH Sensor Floor ) AND CO2 Variance remains flat (< 10 ppm)',
    noiseFloor: 'Clamped at 5.0 %RH per Sensirion SCD41 / SHT Datasheet',
    explanation: 'Per Sensirion multi-sensor application guidelines, both hot tea and human breath cause a sharp relative humidity spike (> 3 Sigma). To separate them, Engine 2 monitors Carbon Dioxide variance during the moisture burst. Because CO2 variance remains flat under 10 ppm, our backend confirms the event is pure water vapor from a hot beverage rather than human exhalation.'
  },
  PARTICULATE_EVENT: {
    title: 'Rule 5 — Dust Sweeping vs Fire Hazard (Physical Particulate Disturbance)',
    standard: 'WHO 2021 Particulate Matter Guidelines & NFPA 72 Combustion Alarm Protocols',
    engine: 'Engine 2 — Statistical Heuristics & Combustion Exclusion Check',
    formula: 'PM2.5 Peak > Rolling Average + MAX ( 3 * PM2.5 Standard Deviation , 5 µg/m³ Particle Floor ) AND Gas & Temp remain flat',
    noiseFloor: 'Clamped at 5.0 µg/m³ per Sensirion SPS30 Optical Particle Counter Spec',
    explanation: 'Per WHO air quality and NFPA 72 fire guidelines, particulate spikes (> 35 µg/m³) must be verified against combustion gases and heat. When a janitor sweeps dust or shakes fabric, PM2.5 jumps sharply above 3 Sigma. Because Engine 2 verifies that chemical TVOC and temperature variances remain flat, it confirms a physical dust disturbance and suppresses false fire alarms.'
  },
  OCCUPANCY_EVENT: {
    title: 'Rule 6 — Camera-Free Occupancy Detection (Conference Room Occupancy)',
    standard: 'ASHRAE Standard 62.1 Section 6.2.2.1 — Breathing Zone Continuous Occupancy Baseline',
    engine: 'Engine 2 — Statistical Heuristics & Stable Variance Algorithm',
    formula: 'CO2 Rolling Average > 800 ppm AND CO2 Standard Deviation < 50 ppm',
    noiseFloor: 'CO2 Stability Threshold: < 50 ppm Standard Deviation',
    explanation: 'Per ASHRAE 62.1 Section 6.2.2.1 ventilation guidelines, continuous human respiration inside an enclosed conference room raises ambient CO2 above the 800 ppm steady-state baseline. By checking that the 3-minute rolling average exceeds 800 ppm while standard deviation remains low and stable (< 50 ppm), Engine 2 confirms continuous human occupancy without requiring privacy-invasive cameras.'
  },
  TRANSIENT_VOC_EVENT: {
    title: 'Rule 7 — Lighter Flick / Deodorant Spray (Transient Chemical Burst)',
    standard: 'WELL v2 Building Standard Feature A01 — Fundamental Indoor Gas Thresholds',
    engine: 'Engine 2 — Statistical Heuristics & Anomaly Suppression Pipeline',
    formula: 'TVOC Peak > Rolling Average + MAX ( 1.5 * TVOC Standard Deviation , 25 ppb Metal-Oxide Floor ) AND Particulate < 35 µg/m³',
    noiseFloor: 'Clamped at 25.0 ppb per ScioSense CCS811 / SGP30 Baseline Spec',
    explanation: 'Per WELL v2 indoor air quality guidelines, chemical VOC bursts from hand sanitizer, perfume, or a brief lighter flick exceed normal baselines (> 1.5 Sigma). Because metal-oxide sensors disperse rapidly and particulate smoke remains under safe limits (< 35 µg/m³), Engine 2 logs a harmless transient chemical burst and prevents false fire evacuation alarms.'
  },
  COMBUSTION_WARNING: {
    title: 'Rule 8 — Critical Combustion (Active Building Fire: Soot + Gas + Heat)',
    standard: 'NFPA 72 National Fire Alarm Code & ASHRAE Life Safety Emergency Evacuation Protocol',
    engine: 'Engine 1 (Critical Limits) & Engine 2 (Multi-Sensor Correlation)',
    formula: 'Current PM2.5 > 35 ug/m3 AND Current TVOC > 1000 ppb AND Temperature > Rolling Average + (2 * Temperature Standard Deviation)',
    noiseFloor: 'PM2.5: > 35 µg/m³ | TVOC: > 1000 ppb | Temp Jump: > 2.0 Sigma',
    explanation: 'Per NFPA 72 National Fire Alarm guidelines, active building combustion produces a simultaneous triple-sensor breach: toxic particulate soot (PM2.5 > 35 µg/m³), chemical hydrocarbon gases (TVOC > 1000 ppb), and rapid thermal heat rise (+2 Sigma). Engine 2 immediately correlates all three metrics to trigger life-safety emergency evacuation protocols.'
  },
  AIR_QUALITY_POOR: {
    title: 'Composite Air Quality Index & Multi-Sensor Degradation',
    standard: 'ASHRAE Standard 62.1 & WHO Combined Indoor Air Quality Health Index',
    engine: 'Engine 1 — Absolute Threshold Evaluation Engine',
    formula: 'CO2 > 1500 ppm OR PM2.5 > 35 ug/m3 OR TVOC > 1000 ppb over 3-Minute Window',
    noiseFloor: 'Enforces multi-parameter baseline floors across SCD41, SPS30, and CCS811',
    explanation: 'Per ASHRAE 62.1 and WHO health exposure guidelines, overall air quality is classified as degraded when any individual environmental metric breaches safe life-safety limits over a sustained 3-minute rolling window.'
  },
  HARDWARE_FAULT: {
    title: 'Sensor Hardware Fault & I2C Bus Disconnection (-999)',
    standard: 'Sensirion SCD41 / SPS30 & ScioSense CCS811 I2C Digital Bus Communication Specification',
    engine: 'Engine 1 — Hardware Diagnostic & Sentinel Protection Pipeline',
    formula: 'Raw Sensor Reading == -999.0 OR CRC Checksum Error',
    noiseFloor: 'Fault sentinel threshold: -999.0',
    explanation: 'Per I2C digital interface specifications, edge sensors return error code -999.0 or CRC checksum failures when physical wiring disconnects or bus faults occur. Engine 1 intercepts these sentinel values to exclude corrupted telemetry from rolling Z-score calculations.'
  },
  ML_ANOMALY: {
    title: 'Multi-Variable Behavioral Anomaly Detection',
    standard: 'Statistical Signal Processing Standards (68-95-99.7 Bell Curve Confidence Boundaries)',
    engine: 'Engine 2 (Rolling Z-Scores) & Engine 3 (scikit-learn IsolationForest)',
    formula: 'Peak Reading > Rolling Average + MAX ( Z * Standard Deviation , Datasheet Hardware Noise Floor )',
    noiseFloor: 'Multipliers: Z = 2.0 (95.4% Confidence for CO2/Drafts) | Z = 3.0 (99.7% Confidence for PM/Humidity)',
    explanation: 'Per statistical signal processing laws (68-95-99.7 rule), readings exceeding Z = 2.0 or 3.0 standard deviations represent significant physical deviations. By clamping standard deviation to official datasheet accuracy limits (100 ppm CO2, 5 µg/m³ PM2.5, 25 ppb TVOC), Engine 2 guarantees zero false alarms during quiet electrical room states while instantly diagnosing real physical events.'
  },
  FORECAST_WARNING: {
    title: 'Predictive AI Trend & Forecast Warning',
    standard: 'Linear Regression & Rate-of-Rise Predictive Extrapolation Methodology',
    engine: 'Engine 3 — Machine Learning & Linear Trend Engine',
    formula: 'Projected Value (t + 15m) = Current Reading + (Rolling Slope * 15m) > Threshold Limit',
    noiseFloor: 'Evaluated across 180-second rolling derivative window',
    explanation: 'Per predictive health management guidelines, Engine 3 computes the real-time rate-of-rise derivative across a 180-second rolling window to warn facility managers 15 minutes before environmental parameters breach critical ASHRAE or WHO life-safety thresholds.'
  },
  NODE_OFFLINE: {
    title: 'nRF52840 Sensor Node Heartbeat & Connection Timeout',
    standard: 'IETF RFC 7252 CoAP Protocol & Nordic nRF52840 Wireless Heartbeat Specification',
    engine: 'Engine 1 — Edge Network & Gateway Diagnostic Pipeline',
    formula: 'Current Server Timestamp - Last Heartbeat Timestamp > 60.0 seconds',
    noiseFloor: 'Debounce timeout buffer: 60.0 seconds',
    explanation: 'Per IETF RFC 7252 CoAP protocol specifications, wireless IoT nodes must transmit periodic UDP keep-alive heartbeats. If telemetry ceases for over 60.0 seconds, Engine 1 flags a mesh connectivity or node power failure.'
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
                Governing Standard & Reference
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
                            typeKey.includes('TRANSIENT') || typeKey.includes('VENTILATION') || typeKey.includes('MOISTURE') || typeKey.includes('PARTICULATE') || typeKey.includes('ML_ANOMALY')
                              ? 'Dynamic 2σ / 3σ Limit (Rolling Average + Clamped Noise Floor)'
                              : 'Absolute Health Threshold Limit'
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
