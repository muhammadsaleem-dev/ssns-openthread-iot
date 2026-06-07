/**
 * App — root component.
 *
 * Manages page routing (simple state-based) and wraps the
 * dashboard layout with MUI ThemeProvider.
 */

import { useState, createContext, useMemo, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './theme';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import AlertsPage from './pages/AlertsPage';

const PAGES = {
  dashboard: DashboardPage,
  nodes: NodesPage,
  alerts: AlertsPage,
};

export const ThemeModeContext = createContext({ toggleColorMode: () => {} });

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const PageComponent = PAGES[activePage] || DashboardPage;

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
    <ThemeModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
          <PageComponent />
        </DashboardLayout>
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
