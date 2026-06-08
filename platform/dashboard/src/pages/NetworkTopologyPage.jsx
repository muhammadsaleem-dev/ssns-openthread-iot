import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Box, Card, CardContent, Typography, Grid, CircularProgress, Chip, alpha, useTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  Drawer, IconButton, Divider, List, ListItem, ListItemText
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HubIcon from '@mui/icons-material/Hub';
import RouterIcon from '@mui/icons-material/Router';
import CellTowerIcon from '@mui/icons-material/CellTower';
import SensorsIcon from '@mui/icons-material/Sensors';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import usePolling from '../hooks/usePolling';
import { fetchNetworkTopology, fetchNodes } from '../services/api';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import API from '../config/api';

// Custom Node for Thread Routers (Blue Hexagon-ish)
const RouterNode = ({ data }) => {
  const isLeader = data.role?.toLowerCase() === 'leader' || data.parentRloc16 === '0xffff';
  const roleLabel = isLeader ? 'LEADER' : 'ROUTER';
  const roleColor = isLeader ? '#F59E0B' : '#3B82F6';
  
  return (
    <Box sx={{
      background: alpha(roleColor, 0.1),
      border: `2px solid ${roleColor}`,
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#fff',
      minWidth: '160px',
      textAlign: 'center',
      boxShadow: `0 0 15px ${alpha(roleColor, 0.4)}`,
      position: 'relative'
    }}>
      <Chip 
        label={roleLabel} 
        size="small" 
        sx={{ 
          position: 'absolute', 
          top: -12, 
          left: '50%', 
          transform: 'translateX(-50%)',
          height: '20px',
          fontSize: '0.6rem',
          fontWeight: 800,
          bgcolor: roleColor,
          color: '#000'
        }} 
      />
      <Handle type="target" position={Position.Top} />
      
      {/* Primary: Hardware ID / Name */}
      <Typography variant="body1" fontWeight="bold" sx={{ mt: 1 }}>
        {isLeader ? '👑 ' : '📡 '}{data.label}
      </Typography>
      
      {/* Secondary: Technical Mesh IDs */}
      <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
        <Typography variant="caption" sx={{ color: '#aaa', display: 'block', fontSize: '0.65rem' }}>
          Mesh ID: {data.nodeId}
        </Typography>
        <Typography variant="caption" sx={{ color: roleColor, fontWeight: 600, fontSize: '0.7rem' }}>
          {data.rloc16}
        </Typography>
      </Box>

      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
};

// Custom Node for End Devices (Green Circle)
const EndDeviceNode = ({ data }) => (
  <Box sx={{
    background: alpha('#10B981', 0.1),
    border: '2px solid #10B981',
    borderRadius: '16px',
    padding: '8px 15px',
    color: '#fff',
    minWidth: '140px',
    textAlign: 'center',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
    position: 'relative'
  }}>
    <Chip 
      label="END DEVICE" 
      size="small" 
      sx={{ 
        position: 'absolute', 
        top: -12, 
        left: '50%', 
        transform: 'translateX(-50%)',
        height: '18px',
        fontSize: '0.55rem',
        fontWeight: 700,
        bgcolor: '#10B981',
        color: '#000'
      }} 
    />
    <Handle type="target" position={Position.Top} />
    
    {/* Primary: Hardware ID / Name */}
    <Typography variant="body2" fontWeight="bold" sx={{ mt: 0.5 }}>
      🍃 {data.label}
    </Typography>
    
    {/* Secondary: Technical Mesh IDs */}
    <Box sx={{ mt: 0.5, pt: 0.5, borderTop: `1px solid ${alpha('#fff', 0.1)}` }}>
      <Typography variant="caption" sx={{ color: '#aaa', display: 'block', fontSize: '0.6rem' }}>
        Mesh ID: {data.nodeId}
      </Typography>
      <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600, fontSize: '0.65rem' }}>
        {data.rloc16}
      </Typography>
    </Box>
  </Box>
);

const nodeTypes = {
  router: RouterNode,
  endDevice: EndDeviceNode,
};

export default function NetworkTopologyPage() {
  const theme = useTheme();
  const { data: topologyList, loading: loadingTopo } = usePolling(fetchNetworkTopology, API.POLL_INTERVAL);
  const { data: registeredNodes } = usePolling(fetchNodes, API.POLL_INTERVAL);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

  const handleNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const closeDrawer = () => setSelectedNode(null);

  // Build the graph layout when data arrives.
  // We aggregate data from multiple Border Routers into a single 'Master Map'.
  useEffect(() => {
    if (!topologyList || !Array.isArray(topologyList)) return;

    const newNodesMap = new Map();
    const newEdgesMap = new Map();

    // Layout configuration
    let routerX = 100;
    let childX = 50;

    topologyList.forEach((topology) => {
      if (!topology.nodes) return;

      topology.nodes.forEach((node) => {
        // A node is a Leader if its role says so OR if it is the root (no parent).
        // Using '0xffff' detection ensures the Border Router is always highlighted 
        // even if the Thread network dynamically changes its role to 'router'.
        const isLeader = node.role?.toLowerCase() === 'leader' || node.parentRloc16 === '0xffff';
        const isRouter = isLeader || node.role?.toLowerCase() === 'router';
        
        // Clean up extAddr and match with registered nodes to find the 'node-abcd' ID.
        const cleanExtAddr = node.extAddr.replace(/:/g, '').toLowerCase();
        const last4 = cleanExtAddr.substring(cleanExtAddr.length - 4);
        const calculatedNodeId = `node-${last4}`;

        // Try to find the registered node using the Mesh ID. 
        // If not found (e.g. legacy data), fallback to trying to match the calculated ID.
        const matchedNode = registeredNodes?.find(n => n.meshId === calculatedNodeId || n.nodeId === calculatedNodeId);
        
        // Primary label: User Location -> Hardware ID -> Fallback to Mesh ID
        const primaryLabel = matchedNode?.location || matchedNode?.nodeId || calculatedNodeId;
        const hardwareId = matchedNode?.nodeId || 'Unknown';

        // Aggregation: De-duplicate nodes seen by multiple gateways.
        // If a node is seen by two BRs, we draw it once but maintain all technical data.
        if (!newNodesMap.has(node.rloc16)) {
          newNodesMap.set(node.rloc16, {
            id: node.rloc16,
            type: isRouter ? 'router' : 'endDevice',
            position: { x: isRouter ? routerX : childX, y: isRouter ? 100 : 250 },
            data: { 
              nodeId: calculatedNodeId,
              hardwareId: hardwareId,
              label: primaryLabel, 
              rloc16: node.rloc16,
              role: isLeader ? 'leader' : node.role,
              parentRloc16: node.parentRloc16,
              status: matchedNode?.status || 'UNKNOWN',
              lastSeenAt: matchedNode?.lastSeenAt,
              extAddr: node.extAddr,
              linkQualityIn: node.linkQualityIn,
              linkQualityOut: node.linkQualityOut,
            },
          });

          if (isRouter) routerX += 200;
          if (!isRouter) childX += 150;
        }

        // Draw edge if parent exists and is not the node itself (avoid self-loops)
        if (node.parentRloc16 && node.parentRloc16 !== '0xffff' && node.parentRloc16 !== node.rloc16) {
          const edgeId = `e-${node.rloc16}-${node.parentRloc16}`;
          if (!newEdgesMap.has(edgeId)) {
            newEdgesMap.set(edgeId, {
              id: edgeId,
              source: node.parentRloc16,
              target: node.rloc16,
              label: `${node.linkQualityIn}%`,
              style: { stroke: '#888', strokeWidth: 2 },
              animated: true
            });
          }
        }
      });
    });

    setNodes(Array.from(newNodesMap.values()));
    setEdges(Array.from(newEdgesMap.values()));
  }, [topologyList, registeredNodes]);

  const totalNodes = nodes.length;
  const routerNodes = nodes.filter(n => n.type === 'router').length;
  const onlineNodes = registeredNodes?.filter(n => n.status === 'ONLINE').length || 0;
  // A simple heuristic for network stability: if > 80% of registered nodes are online
  const stability = registeredNodes?.length > 0 
    ? Math.round((onlineNodes / registeredNodes.length) * 100) 
    : 100;

  if (loadingTopo && !topologyList) {
    return (
      <Box display="flex" justifyContent="center" mt={10}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <SectionHeader title="Network Overview" subtitle="Thread Mesh Topology (Distributed)" />

      {/* Network Health Summary */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Total Nodes in Mesh" 
            value={totalNodes} 
            icon={<HubIcon />} 
            color="#10B981" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Router Nodes" 
            value={routerNodes} 
            icon={<RouterIcon />} 
            color="#3B82F6" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Online Sensors" 
            value={onlineNodes} 
            icon={<SensorsIcon />} 
            color="#8B5CF6" 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard 
            title="Network Stability" 
            value={`${stability}%`} 
            icon={<CellTowerIcon />} 
            color={stability >= 80 ? "#10B981" : "#F59E0B"} 
          />
        </Grid>
      </Grid>

      {/* Multi-Gateway Health Overview */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Active Border Routers</Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {topologyList && topologyList.length > 0 ? (
          topologyList.map((topology) => (
            <Grid item xs={12} md={6} lg={4} key={topology.gatewayId || topology.id}>
              <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="overline" color="text.secondary">
                      BR MAC: {topology.gatewayId?.substring(topology.gatewayId.length - 4) || 'Unknown'}
                    </Typography>
                    <Chip 
                      label={topology.gatewayHealth?.status?.toUpperCase() || 'ACTIVE'} 
                      color={topology.gatewayHealth?.status === 'active' ? "success" : "error"} 
                      size="small" 
                    />
                  </Box>
                  <Box mt={1}>
                    <Typography variant="h5" fontWeight="bold" color="primary">
                      {topology.gatewayHealth?.networkName || 'Border Router'}
                    </Typography>
                    <Box display="flex" flexDirection="column" gap={0.5} mt={2}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Thread Role:</Typography>
                        <Typography variant="body2" fontWeight="bold">Leader</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">PAN ID:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#fff' }}>{topology.gatewayHealth?.panId}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Channel:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#fff' }}>{topology.gatewayHealth?.channel}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Network Uptime:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#fff' }}>{topology.gatewayHealth?.uptime || '0h'}</Typography>
                      </Box>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="body2" color="text.secondary">Connected Nodes:</Typography>
                        <Typography variant="body2" fontWeight="bold" sx={{ color: '#3B82F6' }}>{topology.nodes ? topology.nodes.length : 0}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          <Grid item xs={12}>
            <Typography variant="body2" color="error">No gateways reporting topology.</Typography>
          </Grid>
        )}
      </Grid>

      {/* Interactive React Flow Canvas */}
      <Card sx={{ height: '600px', border: `1px solid ${theme.palette.divider}` }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
          colorMode="dark"
        >
          <Background color="#333" gap={16} />
          <Controls />
          <MiniMap nodeStrokeColor="#fff" nodeColor="#222" />
        </ReactFlow>
      </Card>

      {/* Recent Network Events Placeholder */}
      <Box sx={{ mt: 4, mb: 2 }}>
        <SectionHeader title="Recent Network Events" subtitle="Historical Thread mesh transitions and recovery logs" />
        <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
              Network event history (Node Joins, Role Changes, Partition Merges) is currently running in-memory.
              <br/>
              Backend integration for persistent Thread event logging is planned for Future Work.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Industry Terminology Reference */}
      <Box sx={{ mt: 4, mb: 4 }}>
        <SectionHeader title="Thread Network Terminology" subtitle="Industry-standard roles and definitions" />
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

      {/* Node Details Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(selectedNode)}
        onClose={closeDrawer}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 }, p: 3, bgcolor: 'background.default' }
        }}
      >
        {selectedNode && (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h5" fontWeight="bold">Node Details</Typography>
              <IconButton onClick={closeDrawer} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            
            <Divider sx={{ mb: 2 }} />
            
            <Box display="flex" alignItems="center" gap={2} mb={3}>
              <Typography fontSize="2rem">
                {selectedNode.data.role === 'leader' ? '👑' : selectedNode.data.role === 'router' ? '📡' : '🍃'}
              </Typography>
              <Box>
                <Typography variant="h6" fontWeight="bold">{selectedNode.data.label}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                  {selectedNode.data.role || 'Unknown Role'}
                </Typography>
              </Box>
              <Chip 
                label={selectedNode.data.status} 
                color={selectedNode.data.status === 'ONLINE' ? 'success' : selectedNode.data.status === 'OFFLINE' ? 'error' : 'default'}
                size="small"
                sx={{ ml: 'auto' }}
              />
            </Box>

            <List disablePadding>
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Hardware ID" secondary={selectedNode.data.hardwareId} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Mesh ID (ExtAddr)" secondary={selectedNode.data.nodeId} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="RLOC16 (Short Address)" secondary={<span style={{color: '#3B82F6', fontWeight: 'bold'}}>{selectedNode.data.rloc16}</span>} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Parent RLOC16" secondary={selectedNode.data.parentRloc16 === '0xffff' ? 'None (Is Root)' : selectedNode.data.parentRloc16} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText 
                  primary="Link Quality (In / Out)" 
                  secondary={
                    selectedNode.data.parentRloc16 === '0xffff' 
                    ? 'N/A' 
                    : `${selectedNode.data.linkQualityIn || 0}% / ${selectedNode.data.linkQualityOut || 0}%`
                  } 
                />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Last Seen" secondary={selectedNode.data.lastSeenAt ? new Date(selectedNode.data.lastSeenAt).toLocaleString() : 'N/A'} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="IPv6 Address" secondary={<span style={{ fontStyle: 'italic' }}>Not exposed in current firmware (Phase 2)</span>} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="RSSI" secondary={<span style={{ fontStyle: 'italic' }}>Requires CLI extraction in OTBR (Phase 2)</span>} />
              </ListItem>
              <Divider component="li" />
              <ListItem sx={{ py: 1, px: 0 }}>
                <ListItemText primary="Firmware Version" secondary={<span style={{ fontStyle: 'italic' }}>Not reported in current CBOR payload</span>} />
              </ListItem>
            </List>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
