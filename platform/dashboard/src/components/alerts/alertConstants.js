import PsychologyIcon from '@mui/icons-material/Psychology';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import RouterIcon from '@mui/icons-material/Router';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';

export const OPERATIONAL_TYPES = new Set([
  'TEMPERATURE_HIGH', 'TEMPERATURE_LOW',
  'HIGH_CO2', 'HIGH_PARTICULATES', 'HIGH_VOC',
  'AIR_QUALITY_POOR', 'LIGHT_INTENSITY_HIGH',        // legacy DB compat
  'HARDWARE_FAULT',
]);
export const AI_TYPES = new Set(['ML_ANOMALY', 'FORECAST_WARNING']);
export const INFRA_TYPES = new Set(['NODE_OFFLINE']);

export const CATEGORY_FILTER = {
  all: () => true,
  operational: (a) => OPERATIONAL_TYPES.has(a.type),
  ai: (a) => AI_TYPES.has(a.type),
  infra: (a) => INFRA_TYPES.has(a.type),
};

export const SEVERITY_COLOR = { CRITICAL: 'error', WARNING: 'warning', INFO: 'info' };

export const OPERATIONAL_LABELS = {
  TEMPERATURE_HIGH: 'Temp High',
  TEMPERATURE_LOW: 'Temp Low',
  HIGH_CO2: 'High CO2',
  HIGH_PARTICULATES: 'High PM2.5',
  HIGH_VOC: 'High TVOC',
  AIR_QUALITY_POOR: 'Air Quality (Legacy)',
  LIGHT_INTENSITY_HIGH: 'Light High (Legacy)',
  HARDWARE_FAULT: 'Hardware Fault',
};

export const AI_META = {
  ML_ANOMALY: {
    label: 'Behavioural Anomaly',
    Icon: BubbleChartIcon,
    color: 'warning.main',
    predictive: false,
  },
  FORECAST_WARNING: {
    label: 'Predictive Forecast',
    Icon: TrendingUpIcon,
    color: 'info.main',
    predictive: true,
  },
};

export const getAiMeta = (type) => AI_META[type] ?? { label: type, Icon: PsychologyIcon, color: 'text.secondary', predictive: false };

export const TABS = [
  { key: 'all', label: 'All', Icon: AllInboxIcon },
  { key: 'operational', label: 'Operational', Icon: ThermostatIcon },
  { key: 'ai', label: 'AI Insights', Icon: PsychologyIcon },
  { key: 'infra', label: 'Infrastructure', Icon: RouterIcon },
];
