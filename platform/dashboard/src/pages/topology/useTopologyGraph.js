import { useState, useEffect } from 'react';

function computeGraph(topologyList, registeredNodes) {
  const nodes = [];
  const edges = [];

  if (!topologyList || !Array.isArray(topologyList)) {
    return { nodes, edges };
  }

  const nodesMap = new Map();
  const edgesMap = new Map();
  let routerX = 100;
  let childX = 50;

  topologyList.forEach((topology) => {
    if (topology.gatewayHealth?.status === 'offline') return;
    if (!topology.nodes) return;

    topology.nodes.forEach((node) => {
      const isLeader = node.role?.toLowerCase() === 'leader' || node.parentRloc16 === '0xffff';
      const isRouter = isLeader || node.role?.toLowerCase() === 'router';

      const cleanExtAddr = node.extAddr.replace(/:/g, '').toLowerCase();
      const last4 = cleanExtAddr.substring(cleanExtAddr.length - 4);
      const calculatedNodeId = `node-${last4}`;

      const matchedNode = registeredNodes?.find(n => n.meshId === calculatedNodeId || n.nodeId === calculatedNodeId);

      const primaryLabel = matchedNode?.location || matchedNode?.nodeId || calculatedNodeId;
      const hardwareId = matchedNode?.nodeId || 'Unknown';

      if (!nodesMap.has(node.rloc16)) {
        nodesMap.set(node.rloc16, {
          id: node.rloc16,
          type: isRouter ? 'router' : 'endDevice',
          position: { x: isRouter ? routerX : childX, y: isRouter ? 100 : 250 },
          data: {
            nodeId: calculatedNodeId,
            hardwareId,
            label: primaryLabel,
            rloc16: node.rloc16,
            role: isLeader ? 'leader' : node.role,
            parentRloc16: node.parentRloc16,
            status: matchedNode?.status || 'UNKNOWN',
            lastSeenAt: matchedNode?.lastSeenAt,
            ipv6Address: matchedNode?.ipv6Address,
            extAddr: node.extAddr,
            linkQualityIn: node.linkQualityIn,
            linkQualityOut: node.linkQualityOut,
          },
        });

        if (isRouter) routerX += 200;
        if (!isRouter) childX += 150;
      }

      if (node.parentRloc16 && node.parentRloc16 !== '0xffff' && node.parentRloc16 !== node.rloc16) {
        const edgeId = `e-${node.rloc16}-${node.parentRloc16}`;
        if (!edgesMap.has(edgeId)) {
          edgesMap.set(edgeId, {
            id: edgeId,
            source: node.parentRloc16,
            target: node.rloc16,
            label: `${node.linkQualityIn}%`,
            style: { stroke: '#888', strokeWidth: 2 },
            animated: true,
          });
        }
      }
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };
}

export default function useTopologyGraph(topologyList, registeredNodes) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = computeGraph(topologyList, registeredNodes);
    setNodes(nextNodes);
    setEdges(nextEdges);
  }, [topologyList, registeredNodes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { nodes, edges, setNodes, setEdges };
}
