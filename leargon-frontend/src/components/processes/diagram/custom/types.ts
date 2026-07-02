import type { EventDefinition } from '../../../../api/generated/model/eventDefinition';
import type { GatewayType } from '../../../../api/generated/model/gatewayType';
import type { LocalizedText } from '../../../../api/generated/model/localizedText';

export type FlowNodeType = 'START_EVENT' | 'END_EVENT' | 'TASK' | 'INTERMEDIATE_EVENT' | 'GATEWAY_SPLIT' | 'GATEWAY_JOIN';

export interface LocalNode {
  id: string;
  position: number;
  nodeType: FlowNodeType;
  label?: string | null;
  /** Original multilingual label as stored on the server; other locales are preserved on save. */
  labelI18n?: LocalizedText[] | null;
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
  /** Original multilingual label as stored on the server; other locales are preserved on save. */
  labelI18n?: LocalizedText[] | null;
  nodes: LocalNode[];
}
