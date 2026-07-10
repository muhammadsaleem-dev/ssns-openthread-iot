import { Table, TableHead, TableRow, TableBody, Typography, Button, Box, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { TH, TD, SeverityChip, NodeChip, TimeCell, RecommendedAction, EmptyRow, ROW_HOVER, formatAlertMessage } from './AlertPrimitives';
import { OPERATIONAL_LABELS, getAiMeta } from './alertConstants';
import { ExplainFormulaButton } from './AlertFormulaDialog';

export default function AllAlertsTable({ rows, nodeMap, onResolve, isAdmin = true }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Category</TH><TH>Node</TH><TH>Message</TH><TH>Measured</TH><TH>Limit</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => {
          const isAi = a.type && a.type.startsWith('AI_');
          const isInfra = a.type === 'NODE_OFFLINE';
          const label = isInfra ? 'Node Offline' : (isAi ? getAiMeta(a.type).label : (OPERATIONAL_LABELS[a.type] || a.type));

          return (
            <TableRow key={a.id || i} sx={ROW_HOVER}>
              <SeverityChip severity={a.severity} />
              <TD>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{label}</Typography>
                  <ExplainFormulaButton alert={a} />
                </Box>
              </TD>
              <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
              
              <TD sx={{ maxWidth: 260, py: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: isAi ? 500 : 400 }}>{formatAlertMessage(a)}</Typography>
                </Box>
                {isAi && a.context && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5, fontStyle: 'italic' }}>
                    "{a.context}"
                  </Typography>
                )}
                <RecommendedAction action={a.recommendedAction} />
              </TD>

              <TD>
                {isAi || isInfra ? (
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                ) : a.triggerValue != null ? (
                  <Box>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'error.light' }}>
                      {a.triggerValue === -999 ? 'FAULT' : a.triggerValue.toFixed(1)}
                    </Typography>
                  </Box>
                ) : <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>}
              </TD>
              <TD>
                {isAi || isInfra || a.triggerValue === -999 ? (
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                ) : a.thresholdValue != null ? (
                  <Box>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {a.thresholdValue.toFixed(1)}
                    </Typography>
                  </Box>
                ) : (
                  <Typography sx={{ color: 'text.disabled', fontSize: '0.8rem' }}>—</Typography>
                )}
              </TD>

              <TimeCell ts={a.createdAt} />
              <TD align="center">
                <Tooltip title={!isAdmin ? "Admin privileges required" : ""}>
                  <span>
                    <Button size="small" disabled={!isAdmin || a.resolved} onClick={() => onResolve(a.id)} sx={{ minWidth: 'auto', p: 0.5 }}>
                      <CheckIcon fontSize="small" />
                    </Button>
                  </span>
                </Tooltip>
              </TD>
            </TableRow>
          );
        }) : <EmptyRow colSpan={8} label="No alerts" />}
      </TableBody>
    </Table>
  );
}

