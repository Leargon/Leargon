import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const EVENT_SIZE = 50;
const GATEWAY_SIZE = 60;
const DATA_WIDTH = 120;
const DATA_HEIGHT = 70;

function getNodeDimensions(type: string): { width: number; height: number } {
  if (type === 'startEvent' || type === 'endEvent' || type === 'terminateEndEvent' || type === 'intermediateEvent') {
    return { width: EVENT_SIZE, height: EVENT_SIZE };
  }
  if (type === 'exclusiveGateway' || type === 'inclusiveGateway' || type === 'parallelGateway') {
    return { width: GATEWAY_SIZE, height: GATEWAY_SIZE };
  }
  if (type === 'dataInput' || type === 'dataOutput') {
    return { width: DATA_WIDTH, height: DATA_HEIGHT };
  }
  return { width: NODE_WIDTH, height: NODE_HEIGHT };
}

export function layoutDiagram(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 80 });

  nodes.forEach((node) => {
    const { width, height } = getNodeDimensions(node.type ?? '');
    g.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    const { width, height } = getNodeDimensions(node.type ?? '');
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    };
  });
}
