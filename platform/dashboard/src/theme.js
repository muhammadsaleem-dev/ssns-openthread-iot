/**
 * Material UI dark theme — industrial IoT monitoring aesthetic.
 *
 * Inspired by Grafana and industrial SCADA dashboards:
 * deep dark backgrounds, vibrant accent blues, subtle card surfaces.
 */

import { createTheme, alpha } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3B82F6',      // Vibrant blue
      light: '#60A5FA',
      dark: '#2563EB',
    },
    secondary: {
      main: '#10B981',      // Emerald green — success / online
      light: '#34D399',
      dark: '#059669',
    },
    error: {
      main: '#EF4444',
      light: '#F87171',
    },
    warning: {
      main: '#F59E0B',
      light: '#FBBF24',
    },
    info: {
      main: '#3B82F6',
    },
    background: {
      default: '#0B1120',    // Deep navy
      paper: '#111827',      // Card surface
    },
    text: {
      primary: '#F1F5F9',
      secondary: '#94A3B8',
    },
    divider: alpha('#94A3B8', 0.12),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
    },
    subtitle1: {
      color: '#94A3B8',
      fontSize: '0.875rem',
    },
    body2: {
      color: '#CBD5E1',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#111827',
          border: '1px solid rgba(148, 163, 184, 0.08)',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          '&:hover': {
            borderColor: 'rgba(59, 130, 246, 0.3)',
            boxShadow: '0 0 20px rgba(59, 130, 246, 0.08)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#0F172A',
          borderBottom: '1px solid rgba(148, 163, 184, 0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#0F172A',
          borderRight: '1px solid rgba(148, 163, 184, 0.08)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
        },
      },
    },
  },
});

export default theme;
