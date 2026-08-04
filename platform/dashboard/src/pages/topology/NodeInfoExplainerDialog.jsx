import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton, Tooltip, useTheme, alpha
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CloseIcon from '@mui/icons-material/Close';

const FIELD_GROUPS = [
  {
    section: 'IDENTITY',
    fields: [
      {
        label: 'Hardware ID',
        source: 'nRF52840 factory-programmed FICR unique ID',
        detail: 'Extracted per platform: macOS reads it from the USB device path (/dev/cu.usbmodem...) via regex; Linux queries it directly via udevadm. Stable across firmware reflashes and container restarts -- used as the permanent database key.'
      },
      {
        label: 'EUI-64',
        source: '`ot-ctl extaddr` (OpenThread Extended MAC Address)',
        detail: 'The Thread-layer identity, not the hardware identity. Can regenerate if the Thread stack reinitializes from scratch -- exactly why Hardware ID, not this, is used as the stable database key.'
      },
      {
        label: 'RLOC16',
        source: '`ot-ctl rloc16` (self) / router table & child table (peers)',
        detail: "OpenThread's 16-bit Routing Locator -- this node's current short address within the mesh. Changes if the node's position in the routing tree changes."
      },
    ]
  },
  {
    section: 'NETWORK',
    fields: [
      {
        label: 'Parent',
        source: '`ot-ctl child table` (only accurate for genuine end devices)',
        detail: 'Only end devices/children attach to a single parent. Thread Routers mesh-route via multiple paths -- they have no single "parent" -- so router-role nodes show "N/A" here rather than a fabricated value. The Leader always shows "None (Root)" since it is the top of the routing tree.'
      },
      {
        label: 'Link Quality',
        source: '`ot-ctl router table` / `child table`, LQ In column x 33',
        detail: 'Raw LQ In (0-3 scale) is scaled by 33 to approximate a percentage, clamped at 100%. Only shown when a peer border router has actually observed this node -- a node\'s own self-report always hardcodes 100%/100% (not a real measurement), so that case shows "N/A" instead.'
      },
      {
        label: 'IPv6',
        source: 'Native Thread mesh-local address, from telemetry/topology payload',
        detail: "Shown when the node's own payload includes it. Not currently reported for border-router entries in the topology feed (a scope gap in the current monitoring script, not a platform-specific limitation) -- registered end devices show their genuine address when the gateway forwards it."
      },
    ]
  },
  {
    section: 'STATUS',
    fields: [
      {
        label: 'Last Seen',
        source: 'Topology document write time (border routers) / last telemetry timestamp (end devices)',
        detail: 'For border routers, this is when their topology report was last persisted. For registered sensor nodes, it is their last actual telemetry timestamp.'
      },
      {
        label: 'RSSI',
        source: 'Not yet implemented',
        detail: 'Raw radio signal strength (dBm) requires additional CLI extraction not yet wired into the topology monitor -- flagged as future work, not a bug.'
      },
      {
        label: 'Firmware',
        source: 'Not yet implemented',
        detail: 'Firmware version is not included in the current CBOR telemetry payload -- another flagged future-work item, not a bug.'
      },
    ]
  }
];

export function NodeInfoExplainerButton({ size = 'small' }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <>
      <Tooltip title="Click to see exactly where each field comes from">
        <IconButton
          size={size}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          sx={{
            color: isDark ? '#FBBF24' : '#D97706',
            bgcolor: isDark ? alpha('#FBBF24', 0.12) : alpha('#F59E0B', 0.1),
            border: `1px solid ${isDark ? alpha('#FBBF24', 0.3) : alpha('#F59E0B', 0.3)}`,
            '&:hover': {
              bgcolor: isDark ? alpha('#FBBF24', 0.25) : alpha('#F59E0B', 0.2),
              transform: 'scale(1.08)'
            },
            transition: 'all 0.15s ease',
            p: 0.6,
          }}
        >
          <LightbulbIcon sx={{ fontSize: size === 'small' ? 16 : 18 }} />
        </IconButton>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: theme.palette.background.paper,
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            border: `1px solid ${theme.palette.divider}`
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? alpha('#1E293B', 0.6) : alpha('#F8FAFC', 0.8)
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box sx={{
              p: 1, borderRadius: 2, bgcolor: isDark ? alpha('#FBBF24', 0.15) : alpha('#F59E0B', 0.15),
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <LightbulbIcon sx={{ color: isDark ? '#FBBF24' : '#D97706', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2 }}>
                Where This Data Comes From
              </Typography>
              <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                Field-by-field data provenance
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 3, px: 3 }}>
          {FIELD_GROUPS.map((group, gi) => (
            <Box key={group.section} sx={{ mb: gi < FIELD_GROUPS.length - 1 ? 2.5 : 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.7rem', letterSpacing: 1, color: 'text.secondary', mb: 1 }}>
                {group.section}
              </Typography>
              {group.fields.map((f) => (
                <Box
                  key={f.label}
                  sx={{
                    mb: 1.2, p: 1.2, borderRadius: 1.5,
                    bgcolor: isDark ? alpha('#3B82F6', 0.06) : alpha('#3B82F6', 0.05),
                    borderLeft: `3px solid ${theme.palette.primary.main}`
                  }}
                >
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary' }}>
                    {f.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: isDark ? '#93C5FD' : '#1D4ED8', mt: 0.2 }}>
                    {f.source}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5, lineHeight: 1.5 }}>
                    {f.detail}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, bgcolor: isDark ? alpha('#1E293B', 0.4) : alpha('#F8FAFC', 0.8) }}>
          <Button onClick={() => setOpen(false)} variant="contained" size="small" sx={{ fontWeight: 600, px: 3 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
