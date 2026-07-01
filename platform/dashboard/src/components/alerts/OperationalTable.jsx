import { Table, TableHead, TableRow, TableBody, Typography, Button, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { TH, TD, SeverityChip, NodeChip, TimeCell, RecommendedAction, EmptyRow, ROW_HOVER, formatAlertMessage } from './AlertPrimitives';
import { OPERATIONAL_LABELS } from './alertConstants';

export default function OperationalTable({ rows, nodeMap, onResolve, isAdmin = true }) {
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
              <Typography sx={{ fontSize: '0.8rem' }} noWrap={!a.recommendedAction}>{formatAlertMessage(a)}</Typography>
              <RecommendedAction action={a.recommendedAction} />
            </TD>
            <TD>
              <Typography sx={{ fontWeight: 600, color: 'error.light', fontSize: '0.8rem' }}>
                {a.triggerValue != null ? (a.triggerValue <= -998.5 ? 'FAULT' : (a.triggerValue <= -997.5 ? 'WARMUP' : a.triggerValue.toFixed(1))) : '—'}
              </Typography>
            </TD>
            <TD>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                {a.thresholdValue != null ? a.thresholdValue.toFixed(1) : '—'}
              </Typography>
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
        )) : <EmptyRow colSpan={8} label="No operational alerts" />}
      </TableBody>
    </Table>
  );
}

