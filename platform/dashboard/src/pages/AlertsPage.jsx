import { useState, useMemo } from 'react';
import { Box, Typography, Card, Tabs, Tab, Button, Switch, FormControlLabel, TableContainer, alpha, useTheme, useMediaQuery } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import LoadingOverlay from '../components/LoadingOverlay';
import ErrorBanner from '../components/ErrorBanner';
import CustomPagination from '../components/CustomPagination';
import usePolling from '../hooks/usePolling';
import { fetchAlerts, fetchAlertsPage, fetchNodes, resolveAllAlerts, resolveAlert } from '../services/api';
import API from '../config/api';

import { TABS, OPERATIONAL_TYPES, AI_TYPES, INFRA_TYPES, CATEGORY_FILTER } from '../components/alerts/alertConstants';
import OperationalTable from '../components/alerts/OperationalTable';
import AiInsightsTable from '../components/alerts/AiInsightsTable';
import InfraTable from '../components/alerts/InfraTable';
import AllAlertsTable from '../components/alerts/AllAlertsTable';
import MobileAlertCard from '../components/alerts/MobileAlertCard';

export default function AlertsPage() {
  const { data: nodes, loading: nodesLoading } = usePolling(fetchNodes, API.POLL_INTERVAL);
  
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hideResolved, setHideResolved] = useState(true);

  const { data: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = usePolling(fetchAlerts, API.POLL_INTERVAL);

  const activeTypes = useMemo(() => {
    if (activeTab === 'operational') return Array.from(OPERATIONAL_TYPES);
    if (activeTab === 'ai') return Array.from(AI_TYPES);
    if (activeTab === 'infra') return Array.from(INFRA_TYPES);
    return null;
  }, [activeTab]);

  const fetchPageParams = useMemo(() => [
    page, 
    rowsPerPage, 
    activeTypes, 
    hideResolved
  ], [page, rowsPerPage, activeTypes, hideResolved]);

  const { data: pageData, loading: pageLoading, refetch: refetchPage } = usePolling(
    fetchAlertsPage, 
    API.POLL_INTERVAL, 
    fetchPageParams
  );

  const nodeMap = useMemo(() => {
    const map = {};
    if (nodes) {
      nodes.forEach((n) => {
        map[n.id] = n.location || n.name || n.id;
      });
    }
    return map;
  }, [nodes]);

  const counts = useMemo(() => {
    if (!alerts) return { all: 0, operational: 0, ai: 0, infra: 0 };
    return {
      all:         alerts.length,
      operational: alerts.filter(CATEGORY_FILTER.operational).length,
      ai:          alerts.filter(CATEGORY_FILTER.ai).length,
      infra:       alerts.filter(CATEGORY_FILTER.infra).length,
    };
  }, [alerts]);

  const paginatedAlerts = useMemo(() => {
    if (!pageData || !pageData.content) return [];
    return pageData.content;
  }, [pageData]);

  const unresolvedCount = alerts ? alerts.filter((a) => !a.resolved).length : 0;

  const [resolving, setResolving] = useState(false);
  const handleResolveAll = async () => {
    setResolving(true);
    try {
      let typesToResolve = [];
      if (activeTab === 'operational') typesToResolve = [...OPERATIONAL_TYPES];
      if (activeTab === 'ai') typesToResolve = Array.from(AI_TYPES);
      if (activeTab === 'infra') typesToResolve = Array.from(INFRA_TYPES);
      await resolveAllAlerts(typesToResolve);
      refetchAlerts();
      refetchPage();
    } catch (e) {
      console.error(e);
    } finally {
      setResolving(false);
    }
  };

  const handleResolveOne = async (id) => {
    try {
      await resolveAlert(id);
      refetchAlerts();
      refetchPage();
    } catch (e) {
      console.error(e);
    }
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const loading = alertsLoading || nodesLoading || pageLoading;
  if (loading && !pageData) return <LoadingOverlay message="Loading alerts..." />;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Alerts</Typography>
          <Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>
            {unresolvedCount} unresolved alert{unresolvedCount !== 1 ? 's' : ''} total
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={hideResolved} onChange={(e) => { setHideResolved(e.target.checked); setPage(0); }} size="small" />}
            label={<Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', fontWeight: 500 }}>Hide Resolved</Typography>}
          />
          <Button 
            variant="contained" 
            color="primary"
            disabled={unresolvedCount === 0 || counts[activeTab] === 0 || resolving}
            onClick={handleResolveAll}
            sx={{ fontWeight: 600, textTransform: 'none', borderRadius: 2 }}
          >
            {resolving ? 'Resolving...' : `Resolve ${activeTab === 'all' ? 'All' : 'Category'} Alerts`}
          </Button>
        </Box>
      </Box>

      {alertsError && <ErrorBanner />}

      <Card sx={{ mb: 2.5 }}>

        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v); setPage(0); }}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            px: 2,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 48, fontSize: '0.85rem', textTransform: 'none', fontWeight: 500 },
          }}
        >
          {TABS.map(({ key, label, Icon }) => (
            <Tab
              key={key}
              value={key}
              icon={<Icon fontSize="small" />}
              iconPosition="start"
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  {label}
                  {counts[key] > 0 && (
                    <Box
                      sx={{
                        px: 1, py: 0.2, borderRadius: 3, fontSize: '0.7rem', fontWeight: 700,
                        bgcolor: activeTab === key ? 'primary.main' : alpha('#6B7280', 0.15),
                        color: activeTab === key ? '#fff' : 'text.secondary',
                      }}
                    >
                      {counts[key]}
                    </Box>
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>

        {isMobile ? (
          <Box sx={{ p: 2 }}>
            {paginatedAlerts.length > 0 ? paginatedAlerts.map(a => (
              <MobileAlertCard key={a.id} a={a} nodeMap={nodeMap} onResolve={handleResolveOne} activeTab={activeTab} />
            )) : (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <WarningAmberIcon sx={{ fontSize: 32, mb: 1, color: 'text.secondary' }} />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>No alerts found</Typography>
              </Box>
            )}
          </Box>
        ) : (
          <TableContainer>
            {activeTab === 'operational' && <OperationalTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
            {activeTab === 'ai' && <AiInsightsTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
            {activeTab === 'infra' && <InfraTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
            {activeTab === 'all' && <AllAlertsTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
          </TableContainer>
        )}
        
        <CustomPagination
          count={pageData ? pageData.totalElements : 0}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Card>
    </Box>
  );
}
