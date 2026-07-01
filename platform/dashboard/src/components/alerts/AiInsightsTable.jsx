import { Table, TableHead, TableRow, TableBody, Typography, Button, Box, alpha, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { TH, TD, SeverityChip, NodeChip, TimeCell, RecommendedAction, EmptyRow, ROW_HOVER, formatAlertMessage } from './AlertPrimitives';
import { getAiMeta } from './alertConstants';

export default function AiInsightsTable({ rows, nodeMap, onResolve, isAdmin = true }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TH>Severity</TH><TH>Insight Type</TH><TH>Node</TH>
          <TH>Context</TH><TH>Time</TH><TH>Action</TH>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.length > 0 ? rows.map((a, i) => {
          const meta = getAiMeta(a.type);
          const Icon = meta.Icon;
          return (
            <TableRow key={a.id || i} sx={ROW_HOVER}>
              <SeverityChip severity={a.severity} />
              <TD>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    width: 24, height: 24, borderRadius: 1, 
                    bgcolor: (theme) => {
                      let hex = '#888888';
                      if (meta.color === 'warning.main') hex = theme.palette.warning.main;
                      else if (meta.color === 'info.main') hex = theme.palette.info.main;
                      return alpha(hex, 0.1);
                    } 
                  }}>
                    <Icon sx={{ fontSize: 16, color: meta.color }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{meta.label}</Typography>
                </Box>
              </TD>
              <NodeChip nodeId={a.nodeId} location={nodeMap[a.nodeId]} />
              <TD sx={{ maxWidth: 350, py: 1.5 }}>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatAlertMessage(a)}</Typography>
                {a.context && (
                  <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.5, fontStyle: 'italic' }}>
                    "{a.context}"
                  </Typography>
                )}
                <RecommendedAction action={a.recommendedAction} />
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
        }) : <EmptyRow colSpan={6} label="No AI insights" />}
      </TableBody>
    </Table>
  );
}

