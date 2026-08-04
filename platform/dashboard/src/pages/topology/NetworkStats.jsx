import { Grid } from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import RouterIcon from '@mui/icons-material/Router';
import CellTowerIcon from '@mui/icons-material/CellTower';
import SensorsIcon from '@mui/icons-material/Sensors';
import StatCard from '../../components/StatCard';

export default function NetworkStats({ totalNodes, routerNodes, onlineNodes, stability }) {
  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Total Nodes in Mesh"
          value={totalNodes}
          icon={<HubIcon />}
          color="#10B981"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Router Nodes"
          value={routerNodes}
          icon={<RouterIcon />}
          color="#3B82F6"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Online Sensors"
          value={onlineNodes}
          icon={<SensorsIcon />}
          color="#8B5CF6"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title="Network Stability"
          value={`${stability}%`}
          icon={<CellTowerIcon />}
          color={stability >= 80 ? '#10B981' : '#F59E0B'}
        />
      </Grid>
    </Grid>
  );
}
