import { Table, TableHead, TableRow, TableBody, Typography, Button, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { TH, TD, SeverityChip, NodeChip, TimeCell, EmptyRow, ROW_HOVER, formatAlertMessage } from './AlertPrimitives';

export default function InfraTable({ rows, nodeMap, onResolve, isAdmin = true }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Event</TH><TH>Node</TH>
          <TH>Message</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => (
          <TableRow key={a.id || i} sx={ROW_HOVER}>
            <SeverityChip severity={a.severity} />
            <TD><Typography sx={{ fontSize: '0.8rem', fontWeight: 500 }}>{a.type === 'NODE_OFFLINE' ? 'Node Offline' : a.type}</Typography></TD>
            <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
            <TD sx={{ maxWidth: 350, py: 1.5 }}>
              <Typography sx={{ fontSize: '0.85rem' }}>{formatAlertMessage(a)}</Typography>
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
        )) : <EmptyRow colSpan={6} label="No infrastructure alerts" />}
      </TableBody>
    </Table>
  );
}

