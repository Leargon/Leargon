import type { Node, Edge } from '@xyflow/react';
import type { BusinessEntityResponse } from '../../api/generated/model/businessEntityResponse';
import { layoutNested, domainColor, cardinalityLabel, DEFAULT_GROUP_PADDING } from './diagramUtils';
import type { EntityNodeData, GroupNodeData, RelationshipEdgeData } from './sharedNodes';

const DEFAULT_BORDER = '#1976d2';

/** All relationship + interface edges between entities, at ANY depth (no root-only filtering). */
function buildEntityEdges(
  entities: BusinessEntityResponse[],
  getDesc: (texts: { locale: string; text: string }[]) => string,
): Edge[] {
  const seen = new Set<string>();
  const edges: Edge[] = [];
  entities.forEach((entity) => {
    (entity.relationships ?? []).forEach((rel) => {
      const items = rel.cardinality ?? [];
      if (items.length !== 2) return;
      const [a, b] = items;
      const edgeId = [a.businessEntity.key, b.businessEntity.key].sort().join('__rel__') + (rel.id ?? '');
      if (seen.has(edgeId)) return;
      seen.add(edgeId);
      const cardLabel = `${cardinalityLabel(a.minimum, a.maximum)} — ${cardinalityLabel(b.minimum, b.maximum)}`;
      const desc = rel.descriptions ? getDesc(rel.descriptions) : '';
      const descDisplay = desc.length > 15 ? `${desc.slice(0, 15)}…` : desc;
      edges.push({
        id: edgeId,
        source: a.businessEntity.key,
        target: b.businessEntity.key,
        type: 'relationshipEdge',
        style: { stroke: '#90a4ae' },
        data: { desc, descDisplay, cardLabel } satisfies RelationshipEdgeData,
      });
    });
    (entity.interfacesEntities ?? []).forEach((iface) => {
      const edgeId = `iface__${entity.key}__${iface.key}`;
      if (seen.has(edgeId)) return;
      seen.add(edgeId);
      edges.push({
        id: edgeId,
        source: entity.key,
        target: iface.key,
        type: 'interfaceEdge',
        style: { stroke: '#9c27b0', strokeDasharray: '6,4', strokeWidth: 1.5 },
      });
    });
  });
  return edges;
}

/**
 * Entity map as recursively nested containers. A parent entity becomes a container box that nests
 * its child entities (any depth); leaf entities are plain nodes. When `showDomainLayer` is on,
 * root entities are further wrapped in their bounded-context container. Relationships/interfaces
 * are drawn between the actual entity nodes at any depth. Pure / unit-tested.
 */
export function buildEntityGraph(
  entities: BusinessEntityResponse[],
  showDomainLayer: boolean,
  getName: (e: BusinessEntityResponse) => string,
  getDesc: (texts: { locale: string; text: string }[]) => string,
  getBcName: (bc: { key: string; name?: string | null; names?: { locale: string; text: string }[] | null } | null | undefined) => string,
): { nodes: Node[]; edges: Edge[] } {
  const byKey = new Map(entities.map((e) => [e.key, e]));

  // first parent wins (entity hierarchy is a tree; guard against accidental multi-listing)
  const childToParent = new Map<string, string>();
  entities.forEach((e) =>
    (e.children ?? []).forEach((c) => {
      if (byKey.has(c.key) && !childToParent.has(c.key)) childToParent.set(c.key, e.key);
    }),
  );
  const isContainer = (e: BusinessEntityResponse) =>
    (e.children ?? []).some((c) => childToParent.get(c.key) === e.key);

  // bounded-context colours
  const bcKeys = Array.from(
    new Set(entities.map((e) => e.boundedContext?.key).filter(Boolean) as string[]),
  );
  const bcColor = new Map(bcKeys.map((k, i) => [k, domainColor(i)]));
  const colorOf = (e: BusinessEntityResponse) =>
    (e.boundedContext?.key ? bcColor.get(e.boundedContext.key) : undefined) ?? DEFAULT_BORDER;

  const edges = buildEntityEdges(entities, getDesc);

  const entityNodes: Node[] = entities.map((e) => {
    const parentEntity = childToParent.get(e.key);
    const parentId = parentEntity
      ?? (showDomainLayer && e.boundedContext?.key ? `bc__${e.boundedContext.key}` : undefined);
    const base = { id: e.key, position: { x: 0, y: 0 }, ...(parentId ? { parentId } : {}) };
    if (isContainer(e)) {
      return {
        ...base,
        type: 'entityGroupNode',
        data: {
          label: getName(e),
          color: colorOf(e),
          description: getDesc(e.descriptions ?? []) || undefined,
        } satisfies GroupNodeData,
      } as Node;
    }
    const description = getDesc(e.descriptions ?? []) || undefined;
    return {
      ...base,
      type: 'entityNode',
      width: 180,
      height: 48 + (description ? 16 : 0),
      data: {
        label: getName(e),
        description,
        domainColor: colorOf(e),
      } satisfies EntityNodeData,
    } as Node;
  });

  // bounded-context outer containers (only for root entities, when the layer is on)
  const bcGroupNodes: Node[] = [];
  if (showDomainLayer) {
    const rootBcKeys = Array.from(
      new Set(
        entities
          .filter((e) => !childToParent.has(e.key) && e.boundedContext?.key)
          .map((e) => e.boundedContext!.key),
      ),
    );
    rootBcKeys.forEach((bcKey) => {
      const sample = entities.find((e) => e.boundedContext?.key === bcKey);
      bcGroupNodes.push({
        id: `bc__${bcKey}`,
        type: 'domainGroupNode',
        position: { x: 0, y: 0 },
        data: { label: getBcName(sample?.boundedContext) || bcKey, color: bcColor.get(bcKey) ?? DEFAULT_BORDER } satisfies GroupNodeData,
      } as Node);
    });
  }

  const laid = layoutNested([...bcGroupNodes, ...entityNodes], edges, {
    rankdir: 'LR',
    nodesep: 50,
    ranksep: 120,
    // Parent-entity containers show a description under the name → reserve a taller header.
    paddingFor: (n) =>
      n.type === 'entityGroupNode' && (n.data as unknown as GroupNodeData)?.description
        ? { ...DEFAULT_GROUP_PADDING, top: 56 }
        : DEFAULT_GROUP_PADDING,
  });
  return { nodes: laid, edges };
}
