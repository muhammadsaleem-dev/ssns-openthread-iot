/**
 * Material UI dark theme — industrial IoT monitoring aesthetic.
 *
 * Inspired by Grafana and industrial SCADA dashboards:
 * deep dark backgrounds, vibrant accent blues, subtle card surfaces.
 */

import { createTheme, alpha } from '@mui/material/styles';

export const getTheme = (mode) => createTheme({
  palette: {
    mode,
    ...(mode === 'dark' ? {
      primary: { main: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
      secondary: { main: '#10B981', light: '#34D399', dark: '#059669' },
      error: { main: '#EF4444', light: '#F87171' },
      warning: { main: '#F59E0B', light: '#FBBF24' },
      info: { main: '#3B82F6' },
      background: { default: '#0B1120', paper: '#111827' },
      text: { primary: '#F1F5F9', secondary: '#94A3B8' },
      divider: alpha('#94A3B8', 0.12),
    } : {
      primary: { main: '#2563EB', light: '#60A5FA', dark: '#1D4ED8' },
      secondary: { main: '#059669', light: '#34D399', dark: '#047857' },
      error: { main: '#DC2626', light: '#F87171' },
      warning: { main: '#D97706', light: '#FBBF24' },
      info: { main: '#2563EB' },
      background: { default: '#F8FAFC', paper: '#FFFFFF' },
      text: { primary: '#0F172A', secondary: '#475569' },
      divider: alpha('#0F172A', 0.12),
    }),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontWeight: 600 },
    subtitle1: {
      color: mode === 'dark' ? '#94A3B8' : '#64748B',
      fontSize: '0.875rem',
    },
    body2: {
      color: mode === 'dark' ? '#CBD5E1' : '#334155',
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
          backgroundColor: mode === 'dark' ? '#111827' : '#FFFFFF',
          border: `1px solid ${mode === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
          boxShadow: mode === 'dark' ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
          '&:hover': {
            borderColor: mode === 'dark' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(37, 99, 235, 0.3)',
            boxShadow: mode === 'dark' ? '0 0 20px rgba(59, 130, 246, 0.08)' : '0 4px 20px rgba(37, 99, 235, 0.08)',
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
          backgroundColor: mode === 'dark' ? '#0F172A' : '#FFFFFF',
          borderBottom: `1px solid ${mode === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
          color: mode === 'dark' ? '#F1F5F9' : '#0F172A',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'dark' ? '#0F172A' : '#FFFFFF',
          borderRight: `1px solid ${mode === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
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
