import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, alpha, useTheme } from '@mui/material';

export default function TerminologyTable() {
  const theme = useTheme();

  return (
    <Box sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Thread Network Terminology</Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
        Industry-standard roles and definitions
      </Typography>
      <TableContainer component={Paper} sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5), backgroundImage: 'none' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}>
              <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Network Role</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Technical ID</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Industry Definition & Responsibility</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>Identity Types</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: '15%' }}>Hardware</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography fontSize="1.2rem">👑</Typography>
                  <Typography fontWeight="bold" color="#F59E0B">Leader</Typography>
                </Box>
              </TableCell>
              <TableCell><Chip label="RLOC16: 0x0000" size="small" variant="outlined" sx={{ borderColor: '#F59E0B', color: '#F59E0B' }} /></TableCell>
              <TableCell>
                The central authority of the Thread partition. Responsible for managing Router IDs
                and maintaining mesh consistency. One per partition.
              </TableCell>
              <TableCell>
                <Typography variant="caption" display="block"><strong>Hardware ID:</strong> n/a (BR Identity)</Typography>
                <Typography variant="caption" display="block"><strong>Mesh ID:</strong> Static (Root)</Typography>
              </TableCell>
              <TableCell>Border Router</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography fontSize="1.2rem">📡</Typography>
                  <Typography fontWeight="bold" color="#3B82F6">Router</Typography>
                </Box>
              </TableCell>
              <TableCell><Chip label="FTD (Full)" size="small" variant="outlined" sx={{ borderColor: '#3B82F6', color: '#3B82F6' }} /></TableCell>
              <TableCell>
                A Full Thread Device (FTD) that maintains a routing table and forwards packets.
                Extends range and acts as a parent for End Devices.
              </TableCell>
              <TableCell>
                <Typography variant="caption" display="block"><strong>Hardware ID:</strong> Factory EUI-64 (Permanent)</Typography>
                <Typography variant="caption" display="block"><strong>Mesh ID:</strong> Extended Addr (Volatile)</Typography>
              </TableCell>
              <TableCell>nRF52840 DK</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography fontSize="1.2rem">🍃</Typography>
                  <Typography fontWeight="bold" color="#10B981">End Device</Typography>
                </Box>
              </TableCell>
              <TableCell><Chip label="MTD (Minimal)" size="small" variant="outlined" sx={{ borderColor: '#10B981', color: '#10B981' }} /></TableCell>
              <TableCell>
                A node that communicates only through its parent. Does not forward traffic.
                Can be a Sleepy End Device (SED) for battery optimization.
              </TableCell>
              <TableCell>
                <Typography variant="caption" display="block"><strong>Hardware ID:</strong> Factory EUI-64 (Permanent)</Typography>
                <Typography variant="caption" display="block"><strong>Mesh ID:</strong> Extended Addr (Volatile)</Typography>
              </TableCell>
              <TableCell>Sensor Node</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
