import { useState, useCallback, useEffect, useMemo } from 'react';
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
import TopologyScrubber from './topology/TopologyScrubber';

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
  
  const [selectedHistoricalSnapshot, setSelectedHistoricalSnapshot] = useState(null);

  // If a historical snapshot is selected, use it instead of the LIVE topology list
  // Note: we inject it as a single-item array because useTopologyGraph expects a list of topologies
  const activeTopologyList = useMemo(() => {
    return selectedHistoricalSnapshot ? [selectedHistoricalSnapshot] : topologyList;
  }, [selectedHistoricalSnapshot, topologyList]);

  const { nodes, edges, setNodes, setEdges } = useTopologyGraph(activeTopologyList, registeredNodes);
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
          colorMode={theme.palette.mode}
        >
          <Background color={theme.palette.divider} gap={16} />
          <Controls />
          <MiniMap />
          <FitViewOnDataChange nodeCount={nodes.length} />
        </ReactFlow>
      </Card>

      <Box sx={{ mt: 4, mb: 2 }}>
        <SectionHeader title="Historical Topology Scrubber" subtitle="Inspect historical network states and routing transitions" />
        {/* We find the active Border Router for the scrubber, or fallback to the first one */}
        {topologyList && topologyList.length > 0 && (() => {
          const activeTopo = topologyList.find(t => t.gatewayHealth?.status === 'active') || topologyList[0];
          return (
            <TopologyScrubber 
              borderRouterId={activeTopo.hardwareId} 
              onHistorySelected={setSelectedHistoricalSnapshot} 
            />
          );
        })()}
      </Box>

      <TerminologyTable />

      <NodeDetailsDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
    </Box>
  );
}
