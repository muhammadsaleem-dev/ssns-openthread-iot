/**
 * StatusChip — node online/offline indicator chip.
 */

import { Chip } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const STATUS_MAP = {
  ONLINE: { label: 'Online', color: 'secondary' },
  OFFLINE: { label: 'Offline', color: 'error' },
  UNKNOWN: { label: 'Unknown', color: 'default' },
};

export default function StatusChip({ status }) {
  const config = STATUS_MAP[status] || STATUS_MAP.UNKNOWN;
  return (
    <Chip
      icon={<FiberManualRecordIcon sx={{ fontSize: 10 }} />}
      label={config.label}
      color={config.color}
      size="small"
      variant="outlined"
    />
  );
}
