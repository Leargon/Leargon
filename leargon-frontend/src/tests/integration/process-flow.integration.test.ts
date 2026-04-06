import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signup, withToken, createProcess } from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

const minimalFlow = () => ({
  nodes: [
    { id: 'n-start', position: 0, nodeType: 'START_EVENT' },
    { id: 'n-end',   position: 1, nodeType: 'END_EVENT' },
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
        { id: 'x1', position: 0, nodeType: 'START_EVENT' },
        { id: 'x2', position: 1, nodeType: 'TASK', label: 'Added task' },
        { id: 'x3', position: 2, nodeType: 'END_EVENT' },
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
        { id: 'n1', position: 0, nodeType: 'START_EVENT' },
        { id: 'n2', position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER', label: 'Wait 3 days' },
        { id: 'n3', position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    if (res.status !== 200) console.error('[DEBUG 500]', JSON.stringify(res.data));
    expect(res.status).toBe(200);
    const ev = res.data.nodes.find((n: { nodeType: string }) => n.nodeType === 'INTERMEDIATE_EVENT');
    expect(ev.eventDefinition).toBe('TIMER');
    expect(ev.label).toBe('Wait 3 days');
  });

  it('saves all 5 intermediate event definitions', async () => {
    const proc = await createProcess(client, 'INT Flow All Events');
    const flow = {
      nodes: [
        { id: 'n0', position: 0, nodeType: 'START_EVENT' },
        { id: 'n1', position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'NONE' },
        { id: 'n2', position: 2, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER' },
        { id: 'n3', position: 3, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'MESSAGE' },
        { id: 'n4', position: 4, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'SIGNAL' },
        { id: 'n5', position: 5, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'CONDITIONAL' },
        { id: 'n6', position: 6, nodeType: 'END_EVENT' },
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
        { id: 'c1', position: 0, nodeType: 'START_EVENT' },
        { id: 'c2', position: 1, nodeType: 'TASK', label: 'Inner' },
        { id: 'c3', position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });

    const parent = await createProcess(client, 'INT Parent Process');
    await client.put(`/processes/${parent.key}/flow`, {
      nodes: [
        { id: 'p1', position: 0, nodeType: 'START_EVENT' },
        { id: 'p2', position: 1, nodeType: 'TASK', linkedProcessKey: child.key },
        { id: 'p3', position: 2, nodeType: 'END_EVENT' },
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
        { id: 'p1', position: 0, nodeType: 'START_EVENT' },
        { id: 'p2', position: 1, nodeType: 'TASK', linkedProcessKey: child.key },
        { id: 'p3', position: 2, nodeType: 'END_EVENT' },
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
    const flow = {
      nodes: [
        { id: 'n1', position: 0, nodeType: 'START_EVENT' },
        { id: 'gsp', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'gjn', position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'n4', position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'gsp', trackIndex: 0 },
        { id: 'tb', gatewayNodeId: 'gsp', trackIndex: 1 },
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
    const flow = {
      nodes: [
        { id: 'n1',  position: 0, nodeType: 'START_EVENT' },
        { id: 'gsp', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw1', gatewayType: 'PARALLEL' },
        { id: 'gjn', position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw1', gatewayType: 'PARALLEL' },
        { id: 'n4',  position: 3, nodeType: 'END_EVENT' },
        { id: 'tn1', position: 0, nodeType: 'TASK', label: 'Track A', trackId: 'ta' },
        { id: 'tn2', position: 0, nodeType: 'TASK', label: 'Track B', trackId: 'tb' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'gsp', trackIndex: 0 },
        { id: 'tb', gatewayNodeId: 'gsp', trackIndex: 1 },
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
    const flow = {
      nodes: [
        { id: 'n1',  position: 0, nodeType: 'START_EVENT' },
        { id: 'gsp', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'gjn', position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'n4',  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'gsp', trackIndex: 0, label: 'Yes path' },
        { id: 'tb', gatewayNodeId: 'gsp', trackIndex: 1, label: 'No path'  },
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
    const flow = {
      nodes: [
        { id: 'n1',   position: 0, nodeType: 'START_EVENT' },
        { id: 'sp1',  position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'jn1',  position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw1', gatewayType: 'EXCLUSIVE' },
        { id: 'n4',   position: 3, nodeType: 'END_EVENT' },
        // Track nodes — outer track A contains a nested gateway
        { id: 'sp2',  position: 0, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw2', gatewayType: 'PARALLEL', trackId: 'ta' },
        { id: 'jn2',  position: 1, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw2', gatewayType: 'PARALLEL', trackId: 'ta' },
        // Track nodes — outer track B
        { id: 'tn1',  position: 0, nodeType: 'TASK', label: 'Alt step', trackId: 'tb' },
        // Inner track nodes (belong to inner gateway)
        { id: 'itn1', position: 0, nodeType: 'TASK', label: 'Inner A', trackId: 'tc' },
        { id: 'itn2', position: 0, nodeType: 'TASK', label: 'Inner B', trackId: 'td' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'sp1', trackIndex: 0 },
        { id: 'tb', gatewayNodeId: 'sp1', trackIndex: 1 },
        { id: 'tc', gatewayNodeId: 'sp2', trackIndex: 0 },
        { id: 'td', gatewayNodeId: 'sp2', trackIndex: 1 },
      ],
    };
    const res = await client.put(`/processes/${proc.key}/flow`, flow);
    expect(res.status).toBe(200);
    expect(res.data.tracks.length).toBe(4);
    const innerC = res.data.tracks.find((t: { id: string }) => t.id === 'tc');
    expect(innerC.nodes.some((n: { label: string }) => n.label === 'Inner A')).toBe(true);
  });

  // ── BPMN export ────────────────────────────────────────────────────────────

  it('GET /diagram returns valid BPMN 2.0 XML after saving flow', async () => {
    const proc = await createProcess(client, 'INT BPMN Export');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: 'n1', position: 0, nodeType: 'START_EVENT' },
        { id: 'n2', position: 1, nodeType: 'TASK', label: 'Do work' },
        { id: 'n3', position: 2, nodeType: 'END_EVENT' },
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

  it('GET /diagram emits correct event elements for TIMER event', async () => {
    const proc = await createProcess(client, 'INT BPMN Timer');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: 'n1', position: 0, nodeType: 'START_EVENT' },
        { id: 'n2', position: 1, nodeType: 'INTERMEDIATE_EVENT', eventDefinition: 'TIMER' },
        { id: 'n3', position: 2, nodeType: 'END_EVENT' },
      ],
      tracks: [],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:intermediateCatchEvent');
    expect(res.data.bpmnXml).toContain('bpmn:timerEventDefinition');
  });

  it('GET /diagram emits correct gateway elements for EXCLUSIVE gateway', async () => {
    const proc = await createProcess(client, 'INT BPMN XOR');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: 'n1',  position: 0, nodeType: 'START_EVENT' },
        { id: 'sp1', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw', gatewayType: 'EXCLUSIVE' },
        { id: 'jn1', position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw', gatewayType: 'EXCLUSIVE' },
        { id: 'n4',  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'sp1', trackIndex: 0 },
        { id: 'tb', gatewayNodeId: 'sp1', trackIndex: 1 },
      ],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:exclusiveGateway');
    expect(res.data.bpmnXml).toContain('bpmn:sequenceFlow');
  });

  it('GET /diagram emits correct gateway elements for PARALLEL gateway', async () => {
    const proc = await createProcess(client, 'INT BPMN AND');
    await client.put(`/processes/${proc.key}/flow`, {
      nodes: [
        { id: 'n1',  position: 0, nodeType: 'START_EVENT' },
        { id: 'sp1', position: 1, nodeType: 'GATEWAY_SPLIT', gatewayPairId: 'gw', gatewayType: 'PARALLEL' },
        { id: 'jn1', position: 2, nodeType: 'GATEWAY_JOIN',  gatewayPairId: 'gw', gatewayType: 'PARALLEL' },
        { id: 'n4',  position: 3, nodeType: 'END_EVENT' },
      ],
      tracks: [
        { id: 'ta', gatewayNodeId: 'sp1', trackIndex: 0 },
        { id: 'tb', gatewayNodeId: 'sp1', trackIndex: 1 },
      ],
    });
    const res = await client.get(`/processes/${proc.key}/diagram`);
    expect(res.data.bpmnXml).toContain('bpmn:parallelGateway');
  });
});
