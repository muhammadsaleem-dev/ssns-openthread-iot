import { useState, useEffect } from 'react';
import dagre from '@dagrejs/dagre';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 110;

// Auto-layout the graph top-to-bottom using dagre instead of hand-placed
// coordinates, so the mesh hierarchy (Leader at the root, routers/children
// fanning out below) arranges itself instead of needing manual dragging.
function layoutWithDagre(nodes, edges) {
  if (nodes.length === 0) return nodes;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 70, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      // dagre positions are node centers; React Flow expects top-left.
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
    };
  });
}

function computeGraph(topologyList, registeredNodes) {
  const nodes = [];
  const edges = [];

  if (!topologyList || !Array.isArray(topologyList)) {
    return { nodes, edges };
  }

  const nodesMap = new Map();
  const edgesMap = new Map();

  // A node's own self-entry hardcodes linkQualityIn/Out to 100 (topology_monitor.sh
  // always writes 100 for the self row -- not a real measurement). Another border
  // router's router-table mention of that same node carries a genuinely measured
  // link quality, so build a lookup of those real, foreign-observed values.
  const peerLinkQuality = new Map();
  topologyList.forEach((topology) => {
    if (!topology.nodes) return;
    topology.nodes.forEach((node) => {
      if (node.extAddr !== topology.gatewayId && !peerLinkQuality.has(node.extAddr)) {
        peerLinkQuality.set(node.extAddr, { linkQualityIn: node.linkQualityIn, linkQualityOut: node.linkQualityOut });
      }
    });
  });

  function addNode(node, topology) {
    // Self-entries always hardcode parentRloc16="0xffff" (topology_monitor.sh),
    // regardless of real role, so leader status must come from `role` alone --
    // a border router reporting itself as "router" is not the mesh Leader.
    const isLeader = node.role?.toLowerCase() === 'leader';
    const isRouter = isLeader || node.role?.toLowerCase() === 'router';
    const isSelf = Boolean(topology) && node.extAddr === topology.gatewayId;

    const cleanExtAddr = node.extAddr ? node.extAddr.replace(/:/g, '').toLowerCase() : '';
    const last4 = cleanExtAddr ? cleanExtAddr.substring(cleanExtAddr.length - 4) : node.rloc16;
    const calculatedNodeId = `node-${last4}`;

    const matchedNode = registeredNodes?.find(n => n.meshId === calculatedNodeId || n.nodeId === calculatedNodeId);

    // Border routers report their own identity via /api/network/topology, not
    // /api/nodes (the sensor-telemetry registry), so matchedNode never resolves
    // for a self-entry -- use the topology document's own fields instead.
    const primaryLabel = matchedNode?.location || matchedNode?.nodeId || calculatedNodeId;
    const hardwareId = isSelf ? (topology.hardwareId || 'Unknown') : (matchedNode?.nodeId || 'Unknown');
    const status = isSelf
      ? (topology.gatewayHealth?.status === 'active' ? 'ONLINE' : topology.gatewayHealth?.status === 'offline' ? 'OFFLINE' : 'UNKNOWN')
      : (matchedNode?.status || 'UNKNOWN');

    const peerQuality = peerLinkQuality.get(node.extAddr);
    const linkQualityIn = isSelf && peerQuality ? peerQuality.linkQualityIn : node.linkQualityIn;
    const linkQualityOut = isSelf && peerQuality ? peerQuality.linkQualityOut : node.linkQualityOut;
    const hasRealLinkQuality = isSelf ? Boolean(peerQuality) : true;
    const lastSeenAt = isSelf ? topology.lastUpdatedAt : matchedNode?.lastSeenAt;

    nodesMap.set(node.rloc16, {
      id: node.rloc16,
      type: isRouter ? 'router' : 'endDevice',
      position: { x: 0, y: 0 }, // placeholder -- layoutWithDagre computes the real position
      data: {
        nodeId: calculatedNodeId,
        hardwareId,
        label: primaryLabel,
        rloc16: node.rloc16,
        role: isLeader ? 'leader' : node.role,
        parentRloc16: node.parentRloc16,
        status,
        lastSeenAt,
        ipv6Address: matchedNode?.ipv6Address,
        extAddr: node.extAddr,
        linkQualityIn,
        linkQualityOut,
        hasRealLinkQuality,
      },
    });
  }

  // Pass 1: each topology's own self-entry (extAddr === that topology's
  // gatewayId) is authoritative for its own identity and always wins --
  // otherwise a different border router's stale, generically-"router"
  // mention of the same node (from its router table) could claim that
  // node's slot first and hide the node's own accurate self-report.
  topologyList.forEach((topology) => {
    if (topology.gatewayHealth?.status === 'offline') return;
    if (!topology.nodes) return;

    const selfNode = topology.nodes.find(n => n.extAddr === topology.gatewayId);
    if (selfNode) addNode(selfNode, topology);
  });

  // Pass 2: fill in remaining nodes (routers/children seen only from another
  // border router's tables) without overwriting an established self-report,
  // and wire up edges.
  topologyList.forEach((topology) => {
    if (topology.gatewayHealth?.status === 'offline') return;
    if (!topology.nodes) return;

    topology.nodes.forEach((node) => {
      const isSelf = node.extAddr === topology.gatewayId;
      if (!isSelf && !nodesMap.has(node.rloc16)) {
        addNode(node, topology);
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

  const rawNodes = Array.from(nodesMap.values());
  const rawEdges = Array.from(edgesMap.values());

  return {
    nodes: layoutWithDagre(rawNodes, rawEdges),
    edges: rawEdges,
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
