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
    fontFamily: '"Inter", "Plus Jakarta Sans", sans-serif',
    h1: { fontFamily: '"Outfit", sans-serif', fontWeight: 800 },
    h2: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Outfit", sans-serif', fontWeight: 700 },
    h4: { fontFamily: '"Outfit", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: '"Outfit", sans-serif', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontFamily: '"Outfit", sans-serif', fontWeight: 600 },
    subtitle1: {
      color: mode === 'dark' ? '#94A3B8' : '#64748B',
      fontSize: '0.875rem',
    },
    body2: {
      color: mode === 'dark' ? '#CBD5E1' : '#334155',
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: mode === 'dark' ? 'rgba(17, 24, 39, 0.65)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)'}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: mode === 'dark' ? '0 8px 32px 0 rgba(0, 0, 0, 0.36)' : '0 4px 20px rgba(0,0,0,0.05)',
          '&:hover': {
            borderColor: mode === 'dark' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(37, 99, 235, 0.3)',
            boxShadow: mode === 'dark' ? '0 0 25px rgba(59, 130, 246, 0.15)' : '0 8px 30px rgba(37, 99, 235, 0.12)',
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
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${mode === 'dark' ? 'rgba(148, 163, 184, 0.06)' : 'rgba(15, 23, 42, 0.06)'}`,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.78rem',
        },
        head: {
          fontFamily: '"Outfit", sans-serif',
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: mode === 'dark' ? '#94A3B8' : '#64748B',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s ease',
          '&:hover': {
            backgroundColor: mode === 'dark' ? 'rgba(59, 130, 246, 0.06)' : 'rgba(37, 99, 235, 0.04)',
          },
        },
      },
    },
  },
});
