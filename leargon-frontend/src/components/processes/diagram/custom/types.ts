import type { EventDefinition } from '../../../../api/generated/model/eventDefinition';
import type { GatewayType } from '../../../../api/generated/model/gatewayType';

export type FlowNodeType = 'START_EVENT' | 'END_EVENT' | 'TASK' | 'INTERMEDIATE_EVENT' | 'GATEWAY_SPLIT' | 'GATEWAY_JOIN';

export interface LocalNode {
  id: string;
  position: number;
  nodeType: FlowNodeType;
  label?: string | null;
  linkedProcessKey?: string | null;
  isSubProcess?: boolean;
  trackId?: string | null;
  gatewayPairId?: string | null;
  gatewayType?: GatewayType | null;
  eventDefinition?: EventDefinition | null;
}

export interface LocalTrack {
  id: string;
  gatewayNodeId: string;
  trackIndex: number;
  label?: string | null;
  nodes: LocalNode[];
}
