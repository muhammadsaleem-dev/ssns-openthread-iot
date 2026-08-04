import { useState, useCallback, useEffect } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, alpha, useTheme } from '@mui/material';
import { ReactFlow, Background, Controls, MiniMap, applyNodeChanges, applyEdgeChanges, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import usePolling from '../hooks/usePolling';
import { fetchNetworkTopology, fetchNodes } from '../services/api';
import API from '../config/api';
import SectionHeader from '../components/SectionHeader';
import { nodeTypes } from './topology/nodeTypes';
import useTopologyGraph from './topology/useTopologyGraph';
import NetworkStats from './topology/NetworkStats';
import BorderRouterCards from './topology/BorderRouterCards';
import TerminologyTable from './topology/TerminologyTable';
import NodeDetailsDrawer from './topology/NodeDetailsDrawer';

function FitViewOnDataChange({ nodeCount }) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount > 0) {
      fitView({ padding: 0.2, duration: 300 });
    }
  }, [nodeCount, fitView]);

  return null;
}

export default function NetworkTopologyPage() {
  const theme = useTheme();
  const { data: topologyList, loading: loadingTopo } = usePolling(fetchNetworkTopology, API.POLL_INTERVAL);
  const { data: registeredNodes } = usePolling(fetchNodes, API.POLL_INTERVAL);
  const { nodes, edges, setNodes, setEdges } = useTopologyGraph(topologyList, registeredNodes);
  const [selectedNode, setSelectedNode] = useState(null);

  const onNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const handleNodeClick = useCallback((event, node) => setSelectedNode(node), []);

  const totalNodes = nodes.length;
  const routerNodes = nodes.filter(n => n.type === 'router').length;
  const onlineNodes = registeredNodes?.filter(n => n.status === 'ONLINE').length || 0;
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
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <SectionHeader title="Network Overview" subtitle="Thread Mesh Topology (Distributed)" />

      <NetworkStats
        totalNodes={totalNodes}
        routerNodes={routerNodes}
        onlineNodes={onlineNodes}
        stability={stability}
      />

      <BorderRouterCards topologyList={topologyList} />

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
          <FitViewOnDataChange nodeCount={nodes.length} />
        </ReactFlow>
      </Card>

      <Box sx={{ mt: 4, mb: 2 }}>
        <SectionHeader title="Recent Network Events" subtitle="Historical Thread mesh transitions and recovery logs" />
        <Card sx={{ bgcolor: alpha(theme.palette.background.paper, 0.5) }}>
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center', py: 3 }}>
              Network event history (Node Joins, Role Changes, Partition Merges) is currently running in-memory.
              <br />
              Backend integration for persistent Thread event logging is planned for Future Work.
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <TerminologyTable />

      <NodeDetailsDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </Box>
  );
}
