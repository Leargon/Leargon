import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, withToken, createProcess } from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

let _idSeq = 0;
const uid = () => `pf-${++_idSeq}`;

const minimalFlow = () => ({
  nodes: [
    { id: uid(), position: 0, nodeType: 'START_EVENT' },
    { id: uid(), position: 1, nodeType: 'END_EVENT' },
  ],
  tracks: [],
});

describe('Process Flow API', () => {
  let client: AxiosInstance;
  let token: string;

  beforeAll(async () => {
    client = createClient(getBackendUrl());
    const auth = await signup(client, {
      email: 'flow-tester@example.com',
      username: 'flowtester',
      password: 'password123',
      firstName: 'Flow',
      lastName: 'Tester',
    });
    token = auth.accessToken;
    withToken(client, token);
  });

  // ── GET flow ───────────────────────────────────────────────────────────────

  it('GET /flow returns empty flow for new process', async () => {
    const proc = await createProcess(client, 'INT Flow Empty');
    const res = await client.get(`/processes/${proc.key}/flow`);
    expect(res.status).toBe(200);
    expect(res.data.processKey).toBe(proc.key);
    expect(res.data.nodes).toEqual([]);
    expect(res.data.tracks).toEqual([]);
  });

  it('GET /flow returns 404 for non-existent process', async () => {
    const res = await client.get('/processes/does-not-exist-xyz/flow');
    expect(res.status).toBe(404);
  });

  // ── PUT flow ───────────────────────────────────────────────────────────────

  it('PUT /flow saves start + end nodes', async () => {
    const proc = await createProcess(client, 'INT Flow Start End');
    const res = await client.put(`/processes/${proc.key}/flow`, minimalFlow());
    expect(res.status).toBe(200);
    expect(res.data.nodes.length).toBe(2);
    expect(res.data.nodes.some((n: { nodeType: string }) => n.nodeType === 'START_EVENT')).toBe(true);
    expect(res.data.nodes.some((n: { nodeType: string }) => n.nodeType === 'END_EVENT')).toBe(true);
  });

  it('PUT /flow replaces all nodes atomically on second save', async () => {
    const proc = await createProcess(client, 'INT Flow Replace');
    await client.put(`/processes/${proc.key}/flow`, minimalFlow());

    const updated = {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'TASK', label: 'Added task' },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, updated);
    expect(res.status).toBe(200);
    expect(res.data.nodes.length).toBe(3);
    expect(res.data.nodes.some((n: { label: string }) => n.label === 'Added task')).toBe(true);
  });

  it('PUT /flow returns 403 for non-owner', async () => {
    const proc = await createProcess(client, 'INT Flow Forbidden');

    const otherClient = createClient(getBackendUrl());
    const otherAuth = await signup(otherClient, {
      email: 'flow-other@example.com',
      username: 'flowother',
      password: 'password123',
      firstName: 'Other',
      lastName: 'User',
    });
    withToken(otherClient, otherAuth.accessToken);

    const res = await otherClient.put(`/processes/${proc.key}/flow`, minimalFlow());
    expect(res.status).toBe(403);
  });

  // ── Intermediate events ────────────────────────────────────────────────────

  it('saves and retrieves INTERMEDIATE_EVENT with eventDefinition=TIMER', async () => {
    const proc = await createProcess(client, 'INT Flow Timer');
    const flow = {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER', label: 'Wait 3 days' },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    const ev = res.data.nodes.find((n: { nodeType: string }) => n.nodeType === 'INTERMEDIATE_EVENT');
    expect(ev.eventDefinition).toBe('TIMER');
    expect(ev.label).toBe('Wait 3 days');
  });

  it('saves all 5 intermediate event definitions', async () => {
    const proc = await createProcess(client, 'INT Flow All Events');
    const flow = {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'NONE' },
        { id: uid(), position: 2, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER' },
        { id: uid(), position: 3, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'MESSAGE' },
        { id: uid(), position: 4, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'SIGNAL' },
        { id: uid(), position: 5, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'CONDITIONAL' },
        { id: uid(), position: 6, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    const events = res.data.nodes.filter((n: { nodeType: string }) => n.nodeType === 'INTERMEDIATE_EVENT');
    expect(events.length).toBe(5);
    const defs = events.map((e: { eventDefinition: string }) => e.eventDefinition);
    expect(defs).toContain('TIMER');
    expect(defs).toContain('MESSAGE');
    expect(defs).toContain('SIGNAL');
    expect(defs).toContain('CONDITIONAL');
  });

  // ── isSubProcess detection ─────────────────────────────────────────────────

  it('marks TASK as isSubProcess=true when linked process has content', async () => {
    const child = await createProcess(client, 'INT Child With Flow');
    await client.put(`/processes/${child.key}/flow`, {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'TASK', label: 'Inner' },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });

    const parent = await createProcess(client, 'INT Parent Process');
    await client.put(`/processes/${parent.key}/flow`, {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'TASK', linkedProcessKey: child.key },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });

    const res = await client.get(`/processes/${parent.key}/flow`);
    expect(res.status).toBe(200);
    const task = res.data.nodes.find((n: { nodeType: string }) => n.nodeType === 'TASK');
    expect(task.isSubProcess).toBe(true);
  });

  it('marks TASK as isSubProcess=false when linked process has only Start+End', async () => {
    const child = await createProcess(client, 'INT Empty Child');
    await client.put(`/processes/${child.key}/flow`, minimalFlow());

    const parent = await createProcess(client, 'INT Parent Flat');
    await client.put(`/processes/${parent.key}/flow`, {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'TASK', linkedProcessKey: child.key },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });

    const res = await client.get(`/processes/${parent.key}/flow`);
    const task = res.data.nodes.find((n: { nodeType: string }) => n.nodeType === 'TASK');
    expect(task.isSubProcess).toBe(false);
  });

  // ── Gateway save/load ──────────────────────────────────────────────────────

  it('saves exclusive gateway with 2 tracks', async () => {
    const proc = await createProcess(client, 'INT XOR Gateway');
    const gspId = uid(); const gjnId = uid(); const pairId = uid();
    const taId = uid(); const tbId = uid();
    const flow = {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: gspId, position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: gjnId, position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: uid(), position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: taId, gatewayNodeId: gspId, trackIndex: 0 },
        { id: tbId, gatewayNodeId: gspId, trackIndex: 1 },
      ],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    expect(res.data.tracks.length).toBe(2);
    expect(res.data.nodes.some((n: { nodeType: string }) => n.nodeType === 'GATEWAY_SPLIT')).toBe(true);
    expect(res.data.nodes.some((n: { nodeType: string }) => n.nodeType === 'GATEWAY_JOIN')).toBe(true);
  });

  it('saves gateway with track-level nodes', async () => {
    const proc = await createProcess(client, 'INT Gateway Track Nodes');
    const gspId = uid(); const gjnId = uid(); const pairId = uid();
    const taId = uid(); const tbId = uid();
    const flow = {
      nodes: [
        { id: uid(),  position: 0, nodeType: 'START_EVENT' },
        { id: gspId,  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType: 'PARALLEL' },
        { id: gjnId,  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pairId, gatewayType: 'PARALLEL' },
        { id: uid(),  position: 3, nodeType: 'END_EVENT' },
        { id: uid(),  position: 0, nodeType: 'TASK', label: 'Track A', trackId: taId },
        { id: uid(),  position: 0, nodeType: 'TASK', label: 'Track B', trackId: tbId },
      ],
      tracks: [
        { id: taId, gatewayNodeId: gspId, trackIndex: 0 },
        { id: tbId, gatewayNodeId: gspId, trackIndex: 1 },
      ],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    const trackA = res.data.tracks.find((t: { trackIndex: number }) => t.trackIndex === 0);
    const trackB = res.data.tracks.find((t: { trackIndex: number }) => t.trackIndex === 1);
    expect(trackA.nodes.some((n: { label: string }) => n.label === 'Track A')).toBe(true);
    expect(trackB.nodes.some((n: { label: string }) => n.label === 'Track B')).toBe(true);
  });

  it('saves track label', async () => {
    const proc = await createProcess(client, 'INT Track Label');
    const gspId = uid(); const gjnId = uid(); const pairId = uid();
    const taId = uid(); const tbId = uid();
    const flow = {
      nodes: [
        { id: uid(),  position: 0, nodeType: 'START_EVENT' },
        { id: gspId,  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: gjnId,  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: uid(),  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: taId, gatewayNodeId: gspId, trackIndex: 0, label: 'Yes path' },
        { id: tbId, gatewayNodeId: gspId, trackIndex: 1, label: 'No path'  },
      ],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    const yes = res.data.tracks.find((t: { label: string }) => t.label === 'Yes path');
    const no  = res.data.tracks.find((t: { label: string }) => t.label === 'No path');
    expect(yes).toBeTruthy();
    expect(no).toBeTruthy();
  });

  it('saves nested gateway (topological save)', async () => {
    const proc = await createProcess(client, 'INT Nested Gateway');
    const sp1Id = uid(); const jn1Id = uid(); const pair1Id = uid();
    const sp2Id = uid(); const jn2Id = uid(); const pair2Id = uid();
    const taId = uid(); const tbId = uid(); const tcId = uid(); const tdId = uid();
    const flow = {
      nodes: [
        { id: uid(),  position: 0, nodeType: 'START_EVENT' },
        { id: sp1Id,  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pair1Id, gatewayType: 'EXCLUSIVE' },
        { id: jn1Id,  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pair1Id, gatewayType: 'EXCLUSIVE' },
        { id: uid(),  position: 3, nodeType: 'END_EVENT' },
        // Track nodes — outer track A contains a nested gateway
        { id: sp2Id,  position: 0, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pair2Id, gatewayType: 'PARALLEL', trackId: taId },
        { id: jn2Id,  position: 1, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pair2Id, gatewayType: 'PARALLEL', trackId: taId },
        // Track nodes — outer track B
        { id: uid(),  position: 0, nodeType: 'TASK', label: 'Alt step', trackId: tbId },
        // Inner track nodes (belong to inner gateway)
        { id: uid(),  position: 0, nodeType: 'TASK', label: 'Inner A', trackId: tcId },
        { id: uid(),  position: 0, nodeType: 'TASK', label: 'Inner B', trackId: tdId },
      ],
      tracks: [
        { id: taId, gatewayNodeId: sp1Id, trackIndex: 0 },
        { id: tbId, gatewayNodeId: sp1Id, trackIndex: 1 },
        { id: tcId, gatewayNodeId: sp2Id, trackIndex: 0 },
        { id: tdId, gatewayNodeId: sp2Id, trackIndex: 1 },
      ],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    expect(res.data.tracks.length).toBe(4);
    const innerC = res.data.tracks.find((t: { id: string }) => t.id === tcId);
    expect(innerC.nodes.some((n: { label: string }) => n.label === 'Inner A')).toBe(true);
  });

  // ── BPMN export ────────────────────────────────────────────────────────────

  it.skip('GET /diagram returns valid BPMN 2.0 XML after saving flow', async () => {
    const proc = await createProcess(client, 'INT BPMN Export');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'TASK', label: 'Do work' },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });

    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.status).toBe(200);
    expect(res.data.bpmnXml).toContain('<?xml');
    expect(res.data.bpmnXml).toContain('bpmn:definitions');
    expect(res.data.bpmnXml).toContain('bpmn:startEvent');
    expect(res.data.bpmnXml).toContain('bpmn:endEvent');
    expect(res.data.bpmnXml).toContain('bpmn:callActivity');
  });

  it.skip('GET /diagram emits correct event elements for TIMER event', async () => {
    const proc = await createProcess(client, 'INT BPMN Timer');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: uid(), position: 0, nodeType: 'START_EVENT' },
        { id: uid(), position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER' },
        { id: uid(), position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:intermediateCatchEvent');
    expect(res.data.bpmnXml).toContain('bpmn:timerEventDefinition');
  });

  it.skip('GET /diagram emits correct gateway elements for EXCLUSIVE gateway', async () => {
    const proc = await createProcess(client, 'INT BPMN XOR');
    const sp1Id = uid(); const jn1Id = uid(); const pairId = uid();
    const taId = uid(); const tbId = uid();
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: uid(),  position: 0, nodeType: 'START_EVENT' },
        { id: sp1Id,  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: jn1Id,  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pairId, gatewayType: 'EXCLUSIVE' },
        { id: uid(),  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: taId, gatewayNodeId: sp1Id, trackIndex: 0 },
        { id: tbId, gatewayNodeId: sp1Id, trackIndex: 1 },
      ],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:exclusiveGateway');
    expect(res.data.bpmnXml).toContain('bpmn:sequenceFlow');
  });

  it.skip('GET /diagram emits correct gateway elements for PARALLEL gateway', async () => {
    const proc = await createProcess(client, 'INT BPMN AND');
    const sp1Id = uid(); const jn1Id = uid(); const pairId = uid();
    const taId = uid(); const tbId = uid();
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: uid(),  position: 0, nodeType: 'START_EVENT' },
        { id: sp1Id,  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: pairId, gatewayType: 'PARALLEL' },
        { id: jn1Id,  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: pairId, gatewayType: 'PARALLEL' },
        { id: uid(),  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: taId, gatewayNodeId: sp1Id, trackIndex: 0 },
        { id: tbId, gatewayNodeId: sp1Id, trackIndex: 1 },
      ],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:parallelGateway');
  });
});
