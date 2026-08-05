/**
 * App — root component.
 *
 * Manages page routing (simple state-based) and wraps the
 * dashboard layout with MUI ThemeProvider.
 */

import { useState, createContext, useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import AlertsPage from './pages/AlertsPage';
import AnomalyDetectionSettingsPage from './pages/AnomalyDetectionSettingsPage';
import NetworkTopologyPage from './pages/NetworkTopologyPage';
import NodeMetricsPage from './pages/NodeMetricsPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';

const PAGES = {
  dashboard: DashboardPage,
  nodes: NodesPage,
  alerts: AlertsPage,
  ml: AnomalyDetectionSettingsPage,
  topology: NetworkTopologyPage,
  metrics: NodeMetricsPage,
};

export const ThemeModeContext = createContext({ toggleColorMode: () => {} });

function AppContent() {
  const { user } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const PageComponent = PAGES[activePage] || DashboardPage;

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
      <PageComponent />
    </DashboardLayout>
  );
}

export default function App() {
  // Initialize theme from localStorage or default to dark
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('themeMode') || 'dark';
  });

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === 'light' ? 'dark' : 'light';
          localStorage.setItem('themeMode', newMode);
          return newMode;
        });
      },
    }),
    [],
  );

  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <AuthProvider>
      <ThemeModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <AppContent />
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </AuthProvider>
  );
}

