/**
 * App — root component.
 *
 * Manages page routing (simple state-based) and wraps the
 * dashboard layout with MUI ThemeProvider.
 */

import { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import DashboardLayout from './layouts/DashboardLayout';
import DashboardPage from './pages/DashboardPage';
import NodesPage from './pages/NodesPage';
import AlertsPage from './pages/AlertsPage';

const PAGES = {
  dashboard: DashboardPage,
  nodes: NodesPage,
  alerts: AlertsPage,
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const PageComponent = PAGES[activePage] || DashboardPage;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DashboardLayout activePage={activePage} onNavigate={setActivePage}>
        <PageComponent />
      </DashboardLayout>
    </ThemeProvider>
  );
}
