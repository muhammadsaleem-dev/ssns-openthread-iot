import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Card, CardContent, Typography, Grid, CircularProgress, Chip, alpha, useTheme } from '@mui/material';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import usePolling from '../hooks/usePolling';
import { fetchNetworkTopology, fetchNodes } from '../services/api';
import SectionHeader from '../components/SectionHeader';
import API from '../config/api';

// Custom Node for Thread Routers (Blue Hexagon-ish)
const RouterNode = ({ data }) => {
  const isLeader = data.role?.toLowerCase() === 'leader' || data.parentRloc16 === '0xffff';
  
  return (
    <Box sx={{
      background: isLeader ? alpha('#F59E0B', 0.1) : alpha('#3B82F6', 0.1),
      border: isLeader ? '2px solid #F59E0B' : '2px solid #3B82F6',
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#fff',
      minWidth: '140px',
      textAlign: 'center',
      boxShadow: isLeader ? '0 0 20px rgba(245, 158, 11, 0.5)' : '0 0 15px rgba(59, 130, 246, 0.3)',
      position: 'relative'
    }}>
      {isLeader && (
        <Chip 
          label="LEADER" 
          size="small" 
          sx={{ 
            position: 'absolute', 
            top: -12, 
            left: '50%', 
            transform: 'translateX(-50%)',
            height: '20px',
            fontSize: '0.6rem',
            fontWeight: 800,
            bgcolor: '#F59E0B',
            color: '#000'
          }} 
        />
      )}
      <Handle type="target" position={Position.Top} />
      <Typography variant="body2" sx={{ color: '#aaa', fontSize: '0.7rem' }}>{data.nodeId}</Typography>
      <Typography variant="body1" fontWeight="bold">{isLeader ? '👑 ' : ''}{data.label}</Typography>
      <Typography variant="caption" sx={{ color: isLeader ? '#F59E0B' : '#3B82F6', fontWeight: 600 }}>{data.rloc16}</Typography>
      <Handle type="source" position={Position.Bottom} />
    </Box>
  );
};

// Custom Node for End Devices (Green Circle)
const EndDeviceNode = ({ data }) => (
  <Box sx={{
    background: alpha('#10B981', 0.1),
    border: '2px solid #10B981',
    borderRadius: '20px',
    padding: '8px 15px',
    color: '#fff',
    minWidth: '120px',
    textAlign: 'center',
    boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
  }}>
    <Handle type="target" position={Position.Top} />
    <Typography variant="body2" sx={{ color: '#aaa', fontSize: '0.65rem' }}>{data.nodeId}</Typography>
    <Typography variant="body2" fontWeight="bold">{data.label}</Typography>
    <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 600 }}>{data.rloc16}</Typography>
    <Handle type="source" position={Position.Bottom} />
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

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

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

        const matchedNode = registeredNodes?.find(n => n.nodeId === calculatedNodeId);
        
        // Aggregation: De-duplicate nodes seen by multiple gateways.
        // If a node is seen by two BRs, we draw it once but maintain all technical data.
        if (!newNodesMap.has(node.rloc16)) {
          newNodesMap.set(node.rloc16, {
            id: node.rloc16,
            type: isRouter ? 'router' : 'endDevice',
            position: { x: isRouter ? routerX : childX, y: isRouter ? 100 : 250 },
            data: { 
              nodeId: calculatedNodeId,
              label: matchedNode?.location || calculatedNodeId, 
              rloc16: node.rloc16,
              role: node.role,
              parentRloc16: node.parentRloc16
            },
          });

          if (isRouter) routerX += 200;
          if (!isRouter) childX += 150;
        }

        // Draw edge if parent exists
        if (node.parentRloc16 && node.parentRloc16 !== '0xffff') {
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

      {/* Multi-Gateway Health Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {topologyList && topologyList.length > 0 ? (
          topologyList.map((topology) => (
            <Grid item xs={12} md={4} key={topology.gatewayId || topology.id}>
              <Card sx={{ borderLeft: '4px solid', borderLeftColor: 'primary.main' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    BR: {topology.gatewayId?.substring(topology.gatewayId.length - 4) || 'Unknown'}
                  </Typography>
                  <Box mt={1}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="h5" fontWeight="bold" color="primary">
                        {topology.gatewayHealth?.networkName || 'Border Router'}
                      </Typography>
                      <Chip 
                        label={topology.gatewayHealth?.status?.toUpperCase() || 'ACTIVE'} 
                        color={topology.gatewayHealth?.status === 'active' ? "success" : "error"} 
                        size="small" 
                      />
                    </Box>
                    <Box display="flex" justifyContent="space-between" mt={2}>
                      <Typography variant="body2" color="text.secondary">PAN ID: <strong style={{color:'#fff'}}>{topology.gatewayHealth?.panId}</strong></Typography>
                      <Typography variant="body2" color="text.secondary">Channel: <strong style={{color:'#fff'}}>{topology.gatewayHealth?.channel}</strong></Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" mt={1}>Uptime: <strong style={{color:'#fff'}}>{topology.gatewayHealth?.uptime || '0h'}</strong></Typography>
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
        
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary">Total Mesh Devices</Typography>
              <Box display="flex" alignItems="baseline" mt={1}>
                <Typography variant="h3" fontWeight="bold">{nodes.length}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>Aggregated Nodes</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Interactive React Flow Canvas */}
      <Card sx={{ height: '600px', border: `1px solid ${theme.palette.divider}` }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          colorMode="dark"
        >
          <Background color="#333" gap={16} />
          <Controls />
          <MiniMap nodeStrokeColor="#fff" nodeColor="#222" />
        </ReactFlow>
      </Card>
    </Box>
  );
}
