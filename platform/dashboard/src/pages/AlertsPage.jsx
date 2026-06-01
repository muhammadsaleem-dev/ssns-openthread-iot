/**
 * AlertsPage — semantically adaptive alert management panel.
 *
 * Presents the unified backend alert feed through four contextual views:
 *   All          → universal adaptive schema
 *   Operational  → deterministic threshold schema (Measured / Threshold)
 *   AI Insights  → clean insight schema with a single explanatory callout
 *   Infrastructure → simplified lifecycle schema
 *
 * All categorisation is client-side. No backend or API changes required.
 */

import { useMemo, useState, useCallback } from 'react';
import {
  Box, Card, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, Tabs, Tab,
  Alert as MuiAlert, alpha, TablePagination, Button, Switch, FormControlLabel
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RouterIcon from '@mui/icons-material/Router';
import AllInboxIcon from '@mui/icons-material/AllInbox';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import CheckIcon from '@mui/icons-material/Check';

import LoadingOverlay from '../components/LoadingOverlay';
import ErrorBanner from '../components/ErrorBanner';
import usePolling from '../hooks/usePolling';
import { fetchAlerts, fetchAlertsPage, fetchNodes, resolveAllAlerts, resolveAlert } from '../services/api';
import { formatTimestamp } from '../utils/format';
import API from '../config/api';

// ── Category membership ────────────────────────────────────────────────────────

const OPERATIONAL_TYPES = new Set([
  'TEMPERATURE_HIGH', 'TEMPERATURE_LOW',
  'HIGH_CO2', 'HIGH_PARTICULATES', 'HIGH_VOC',
  'AIR_QUALITY_POOR', 'LIGHT_INTENSITY_HIGH',        // legacy DB compat
]);
const AI_TYPES = new Set(['ML_ANOMALY', 'FORECAST_WARNING']);
const INFRA_TYPES = new Set(['NODE_OFFLINE']);

const CATEGORY_FILTER = {
  all: () => true,
  operational: (a) => OPERATIONAL_TYPES.has(a.type),
  ai: (a) => AI_TYPES.has(a.type),
  infra: (a) => INFRA_TYPES.has(a.type),
};

// ── Display helpers ────────────────────────────────────────────────────────────

const SEVERITY_COLOR = { CRITICAL: 'error', WARNING: 'warning', INFO: 'info' };

const OPERATIONAL_LABELS = {
  TEMPERATURE_HIGH: 'Temp High',
  TEMPERATURE_LOW: 'Temp Low',
  HIGH_CO2: 'High CO2',
  HIGH_PARTICULATES: 'High PM2.5',
  HIGH_VOC: 'High TVOC',
  AIR_QUALITY_POOR: 'Air Quality (Legacy)',
  LIGHT_INTENSITY_HIGH: 'Light High (Legacy)',
};

// AI type → compact display label + icon
const AI_META = {
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

const getAiMeta = (type) => AI_META[type] ?? { label: type, Icon: PsychologyIcon, color: 'text.secondary', predictive: false };

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all', label: 'All', Icon: AllInboxIcon },
  { key: 'operational', label: 'Operational', Icon: ThermostatIcon },
  { key: 'ai', label: 'AI Insights', Icon: PsychologyIcon },
  { key: 'infra', label: 'Infrastructure', Icon: RouterIcon },
];

// ── Shared primitives ──────────────────────────────────────────────────────────

const TH = ({ children, sx = {} }) => (
  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.8rem', whiteSpace: 'nowrap', ...sx }}>
    {children}
  </TableCell>
);

const TD = ({ children, sx = {} }) => (
  <TableCell sx={{ fontSize: '0.8rem', verticalAlign: 'middle', ...sx }}>
    {children}
  </TableCell>
);

const SeverityChip = ({ severity }) => (
  <TD>
    <Chip label={severity} size="small" color={SEVERITY_COLOR[severity] || 'default'} sx={{ height: 22, minWidth: 72 }} />
  </TD>
);

const NodeChip = ({ nodeId, location }) => (
  <TD>
    <Chip label={location || nodeId} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
  </TD>
);

const TimeCell = ({ ts }) => (
  <TableCell sx={{ color: 'text.secondary', fontSize: '0.75rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
    {formatTimestamp(ts)}
  </TableCell>
);

const RecommendedAction = ({ action }) => {
  if (!action) return null;
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6, mt: 0.75, bgcolor: alpha('#FBBF24', 0.15), p: 0.75, borderRadius: 1, border: `1px solid ${alpha('#FBBF24', 0.3)}` }}>
      <LightbulbOutlinedIcon sx={{ fontSize: 16, color: '#FCD34D', mt: 0.1 }} />
      <Typography sx={{ fontSize: '0.75rem', color: '#FDE68A', fontWeight: 600, lineHeight: 1.3 }}>
        {action}
      </Typography>
    </Box>
  );
};

const ROW_HOVER = { '&:last-child td': { borderBottom: 0 }, '&:hover': { bgcolor: alpha('#3B82F6', 0.04) } };

const EmptyRow = ({ colSpan, label }) => (
  <TableRow>
    <TableCell colSpan={colSpan} align="center" sx={{ py: 6, color: 'text.secondary' }}>
      <WarningAmberIcon sx={{ fontSize: 32, mb: 1, display: 'block', mx: 'auto', color: 'text.secondary' }} />
      <Typography variant="body2">{label ?? 'No alerts'}</Typography>
    </TableCell>
  </TableRow>
);

// ── Table: Operational ─────────────────────────────────────────────────────────

function OperationalTable({ rows, nodeMap, onResolve }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Type</TH><TH>Node</TH>
          <TH>Message</TH><TH>Measured</TH><TH>Threshold</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => (
          <TableRow key={a.id || i} sx={ROW_HOVER}>
            <SeverityChip severity={a.severity} />
            <TD><Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{OPERATIONAL_LABELS[a.type] || a.type}</Typography></TD>
            <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
            <TD sx={{ maxWidth: 280, py: 1.5 }}>
              <Typography sx={{ fontSize: '0.8rem' }} noWrap={!a.recommendedAction}>{a.message}</Typography>
              <RecommendedAction action={a.recommendedAction} />
            </TD>
            <TD>
              <Typography sx={{ fontWeight: 600, color: 'error.light', fontSize: '0.8rem' }}>
                {a.triggerValue != null ? a.triggerValue.toFixed(1) : '—'}
              </Typography>
            </TD>
            <TD>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {a.thresholdValue != null ? a.thresholdValue.toFixed(1) : '—'}
              </Typography>
            </TD>
            <TimeCell ts={a.createdAt} />
            <TD align="center">
              <Button size="small" disabled={a.resolved} onClick={() => onResolve(a.id)} sx={{ minWidth: 'auto', p: 0.5 }}>
                <CheckIcon fontSize="small" />
              </Button>
            </TD>
          </TableRow>
        )) : <EmptyRow colSpan={8} label="No operational alerts" />}
      </TableBody>
    </Table>
  );
}

// ── Table: AI Insights ─────────────────────────────────────────────────────────

function AiInsightsTable({ rows, nodeMap, onResolve }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Type</TH><TH>Node</TH><TH>Details</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => {
          const meta = getAiMeta(a.type);
          return (
            <TableRow
              key={a.id || i}
              sx={{
                ...ROW_HOVER,
                borderLeft: '3px solid',
                borderColor: meta.predictive ? 'info.main' : 'warning.main',
              }}
            >
              <SeverityChip severity={a.severity} />
              <TD>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                  <meta.Icon sx={{ fontSize: 16, color: meta.color }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{meta.label}</Typography>
                </Box>
              </TD>
              <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
              <TD sx={{ maxWidth: 420, py: 1.5 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: a.context ? 500 : 400 }}>{a.message}</Typography>
                {a.context && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>
                    {a.context}
                  </Typography>
                )}
                <RecommendedAction action={a.recommendedAction} />
              </TD>
              <TimeCell ts={a.createdAt} />
              <TD align="center">
                <Button size="small" disabled={a.resolved} onClick={() => onResolve(a.id)} sx={{ minWidth: 'auto', p: 0.5 }}>
                  <CheckIcon fontSize="small" />
                </Button>
              </TD>
            </TableRow>
          );
        }) : <EmptyRow colSpan={6} label="No AI insight alerts" />}
      </TableBody>
    </Table>
  );
}

// ── Table: Infrastructure ──────────────────────────────────────────────────────

function InfraTable({ rows, nodeMap, onResolve }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Event</TH><TH>Node</TH><TH>Details</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => (
          <TableRow key={a.id || i} sx={ROW_HOVER}>
            <SeverityChip severity={a.severity} />
            <TD><Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>Node Offline</Typography></TD>
            <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
            <TD sx={{ maxWidth: 420 }}><Typography sx={{ fontSize: '0.8rem' }}>{a.message}</Typography></TD>
            <TimeCell ts={a.createdAt} />
            <TD align="center">
              <Button size="small" disabled={a.resolved} onClick={() => onResolve(a.id)} sx={{ minWidth: 'auto', p: 0.5 }}>
                <CheckIcon fontSize="small" />
              </Button>
            </TD>
          </TableRow>
        )) : <EmptyRow colSpan={6} label="No infrastructure events" />}
      </TableBody>
    </Table>
  );
}

// ── Table: All (universal adaptive) ───────────────────────────────────────────

function AllAlertsTable({ rows, nodeMap, onResolve }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Category</TH><TH>Node</TH><TH>Message</TH><TH>Detail</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => {
          const isAi = AI_TYPES.has(a.type);
          const isInfra = INFRA_TYPES.has(a.type);
          const meta = isAi ? getAiMeta(a.type) : null;

          return (
            <TableRow
              key={a.id || i}
              sx={{
                ...ROW_HOVER,
                ...(isAi && { borderLeft: '3px solid', borderColor: meta.predictive ? 'info.main' : 'warning.main' }),
              }}
            >
              <SeverityChip severity={a.severity} />

              {/* Category label */}
              <TD>
                {isAi ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <meta.Icon sx={{ fontSize: 14, color: meta.color }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{meta.label}</Typography>
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {isInfra ? 'Node Offline' : OPERATIONAL_LABELS[a.type] || a.type}
                  </Typography>
                )}
              </TD>

              <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />

              <TD sx={{ maxWidth: 280, py: 1.5 }}>
                <Typography sx={{ fontSize: '0.8rem' }} noWrap={!a.recommendedAction}>{a.message}</Typography>
                <RecommendedAction action={a.recommendedAction} />
              </TD>

              {/* Adaptive detail — threshold pair for operational, short label for AI/infra */}
              <TD>
                {isAi ? (
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', fontStyle: 'italic', maxWidth: 250 }} noWrap>
                    {a.context || '—'}
                  </Typography>
                ) : a.triggerValue != null ? (
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'error.light' }}>
                    {a.triggerValue.toFixed(1)}
                    {a.thresholdValue != null && (
                      <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 0.5 }}>
                        / {a.thresholdValue.toFixed(1)}
                      </Typography>
                    )}
                  </Typography>
                ) : (
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                )}
              </TD>

              <TimeCell ts={a.createdAt} />
              <TD align="center">
                <Button size="small" disabled={a.resolved} onClick={() => onResolve(a.id)} sx={{ minWidth: 'auto', p: 0.5 }}>
                  <CheckIcon fontSize="small" />
                </Button>
              </TD>
            </TableRow>
          );
        }) : <EmptyRow colSpan={7} label="No alerts have been triggered yet" />}
      </TableBody>
    </Table>
  );
}


// ── Page ───────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const { data: nodes, loading: nodesLoading } = usePolling(fetchNodes, API.POLL_INTERVAL);
  
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hideResolved, setHideResolved] = useState(true);

  // Still fetch all alerts ONLY to drive the global unresolved count and tab counts without breaking backend.
  // In a massive deployment, we would replace this with dedicated count endpoints.
  const { data: alerts, loading: alertsLoading, error: alertsError, refetch: refetchAlerts } = usePolling(fetchAlerts, API.POLL_INTERVAL);

  const fetchPaginatedFn = useCallback(() => {
    let types = [];
    if (activeTab === 'operational') types = Array.from(OPERATIONAL_TYPES);
    else if (activeTab === 'ai') types = Array.from(AI_TYPES);
    else if (activeTab === 'infra') types = Array.from(INFRA_TYPES);
    
    return fetchAlertsPage(hideResolved, types, page, rowsPerPage);
  }, [activeTab, page, rowsPerPage, hideResolved]);

  const { data: pageData, loading: pageLoading, refetch: refetchPage } = usePolling(fetchPaginatedFn, page === 0 ? API.POLL_INTERVAL : null);

  const nodeMap = useMemo(() => {
    const map = {};
    if (nodes) {
      nodes.forEach(n => {
        map[n.nodeId] = n.location || n.nodeId;
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

  const loading = alertsLoading || nodesLoading || pageLoading;
  if (loading && !pageData) return <LoadingOverlay message="Loading alerts..." />;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>

      {/* Page header */}
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

        {/* Tab navigation */}
        <Tabs
          value={activeTab}
          onChange={(_, v) => { setActiveTab(v); setPage(0); }}
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
                    <Chip
                      label={counts[key]}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.7rem', fontWeight: 700,
                        bgcolor: activeTab === key ? 'primary.main' : alpha('#6B7280', 0.15),
                        color: activeTab === key ? '#fff' : 'text.secondary',
                        '.MuiChip-label': { px: 0.8 },
                      }}
                    />
                  )}
                </Box>
              }
            />
          ))}
        </Tabs>



        {/* Adaptive table */}
        <TableContainer>
          {activeTab === 'operational' && <OperationalTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
          {activeTab === 'ai' && <AiInsightsTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
          {activeTab === 'infra' && <InfraTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
          {activeTab === 'all' && <AllAlertsTable rows={paginatedAlerts} nodeMap={nodeMap} onResolve={handleResolveOne} />}
        </TableContainer>
        
        <TablePagination
          component="div"
          count={pageData ? pageData.totalElements : 0}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </Card>
    </Box>
  );
}
