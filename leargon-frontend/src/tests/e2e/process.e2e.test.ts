import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  withToken,
  createProcess,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { SaveProcessDiagramRequest } from '@/api/generated/model/saveProcessDiagramRequest';
import type { ProcessDiagramResponse } from '@/api/generated/model/processDiagramResponse';
import type { ProcessVersionResponse } from '@/api/generated/model/processVersionResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import { ProcessElementType } from '@/api/generated/model/processElementType';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Process E2E', () => {
  let client: AxiosInstance;
  let token: string;

  beforeAll(async () => {
    client = createClient(getBackendUrl());

    const auth = await signup(client, {
      email: 'fe-proc-user@example.com',
      username: 'feprocuser',
      password: 'password123',
      firstName: 'Process',
      lastName: 'Tester',
    });
    token = auth.accessToken;
    withToken(client, token);
  });

  // =====================
  // CREATE
  // =====================

  it('should create process with name-based key', async () => {
    const proc = await createProcess(client, 'FE Order Fulfillment');
    expect(proc.key).toBe('fe-order-fulfillment');
    expect(proc.processOwner.username).toBe('feprocuser');
  });

  it('should create process with code-based key', async () => {
    const proc = await createProcess(client, 'FE Code Process', {
      code: 'FE-ORD-FULFILL',
    });
    expect(proc.key).toBe('fe-ord-fulfill');
    expect(proc.code).toBe('FE-ORD-FULFILL');
  });

  // =====================
  // READ
  // =====================

  it('should list all processes', async () => {
    await createProcess(client, 'FE List A');
    await createProcess(client, 'FE List B');

    const res = await client.get<ProcessResponse[]>('/processes');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThanOrEqual(2);
  });

  it('should get process by key', async () => {
    const proc = await createProcess(client, 'FE Gettable Process');

    const res = await client.get<ProcessResponse>(`/processes/${proc.key}`);
    expect(res.status).toBe(200);
    expect(res.data.key).toBe(proc.key);
  });

  it('should return 404 for non-existent process', async () => {
    const res = await client.get('/processes/nonexistent-fe-key');
    expect(res.status).toBe(404);
  });

  // =====================
  // UPDATE
  // =====================

  it('should update process names and recompute key', async () => {
    const proc = await createProcess(client, 'FE Old Name');

    const res = await client.put(`/processes/${proc.key}/names`, [
      { locale: 'en', text: 'FE New Name' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.key).toBe('fe-new-name');
    expect(res.data.names[0].text).toBe('FE New Name');
  });

  it('should update process descriptions', async () => {
    const proc = await createProcess(client, 'FE Desc Process');

    const res = await client.put(`/processes/${proc.key}/descriptions`, [
      { locale: 'en', text: 'A great FE description' },
    ]);
    expect(res.status).toBe(200);
    expect(res.data.descriptions.length).toBe(1);
    expect(res.data.descriptions[0].text).toBe('A great FE description');
  });

  // =====================
  // DIAGRAM - SAVE & GET
  // =====================

  it('should save diagram with start, task, and end', async () => {
    const mainProc = await createProcess(client, 'FE Diagram Main');
    const linkedProc = await createProcess(client, 'FE Diagram Linked');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'start-1',
          elementType: ProcessElementType.NONE_START_EVENT,
          sortOrder: 0,
        },
        {
          elementId: 'task-1',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: linkedProc.key,
          sortOrder: 1,
        },
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: 2,
        },
      ],
      flows: [
        { flowId: 'flow-1', sourceElementId: 'start-1', targetElementId: 'task-1' },
        { flowId: 'flow-2', sourceElementId: 'task-1', targetElementId: 'end-1' },
      ],
    };

    const putRes = await client.put<ProcessDiagramResponse>(
      `/processes/${mainProc.key}/diagram`,
      diagramReq,
    );
    expect(putRes.status).toBe(200);
    expect(putRes.data.elements.length).toBe(3);
    expect(putRes.data.flows.length).toBe(2);

    // GET should return the saved diagram
    const getRes = await client.get<ProcessDiagramResponse>(
      `/processes/${mainProc.key}/diagram`,
    );
    expect(getRes.data.elements.length).toBe(3);
    expect(getRes.data.flows.length).toBe(2);
  });

  it('should save diagram with gateway and labels', async () => {
    const proc = await createProcess(client, 'FE Gateway Process');
    const task1 = await createProcess(client, 'FE GW Task 1');
    const task2 = await createProcess(client, 'FE GW Task 2');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'start-1',
          elementType: ProcessElementType.NONE_START_EVENT,
          sortOrder: 0,
        },
        {
          elementId: 'gw-1',
          elementType: ProcessElementType.EXCLUSIVE_GATEWAY,
          labels: [{ locale: 'en', text: 'Approved?' }],
          sortOrder: 1,
        },
        {
          elementId: 'task-1',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: task1.key,
          sortOrder: 2,
        },
        {
          elementId: 'task-2',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: task2.key,
          sortOrder: 3,
        },
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: 4,
        },
      ],
      flows: [
        { flowId: 'flow-1', sourceElementId: 'start-1', targetElementId: 'gw-1' },
        {
          flowId: 'flow-2',
          sourceElementId: 'gw-1',
          targetElementId: 'task-1',
          labels: [{ locale: 'en', text: 'Yes' }],
        },
        {
          flowId: 'flow-3',
          sourceElementId: 'gw-1',
          targetElementId: 'task-2',
          labels: [{ locale: 'en', text: 'No' }],
        },
        { flowId: 'flow-4', sourceElementId: 'task-1', targetElementId: 'end-1' },
        { flowId: 'flow-5', sourceElementId: 'task-2', targetElementId: 'end-1' },
      ],
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);
    expect(res.data.elements.length).toBe(5);

    const gateway = res.data.elements.find((e) => e.elementId === 'gw-1');
    expect(gateway?.labels?.length).toBe(1);
    expect(gateway?.labels?.[0].text).toBe('Approved?');

    const yesFlow = res.data.flows.find((f) => f.flowId === 'flow-2');
    expect(yesFlow?.labels?.[0].text).toBe('Yes');
  });

  // =====================
  // DIAGRAM - VALIDATION
  // =====================

  it('should reject diagram without start event', async () => {
    const proc = await createProcess(client, 'FE No Start Process');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: 0,
        },
      ],
      flows: [],
    };

    const res = await client.put(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(400);
  });

  // =====================
  // VERSION HISTORY
  // =====================

  it('should include DIAGRAM_UPDATE in version history', async () => {
    const proc = await createProcess(client, 'FE Version Diagram');
    const linked = await createProcess(client, 'FE Proc Version Linked');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'start-1',
          elementType: ProcessElementType.NONE_START_EVENT,
          sortOrder: 0,
        },
        {
          elementId: 'task-1',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: linked.key,
          sortOrder: 1,
        },
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: 2,
        },
      ],
      flows: [
        { flowId: 'flow-1', sourceElementId: 'start-1', targetElementId: 'task-1' },
        { flowId: 'flow-2', sourceElementId: 'task-1', targetElementId: 'end-1' },
      ],
    };

    await client.put(`/processes/${proc.key}/diagram`, diagramReq);

    const versionsRes = await client.get<ProcessVersionResponse[]>(
      `/processes/${proc.key}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.some((v) => v.changeType === 'DIAGRAM_UPDATE')).toBe(true);
  });

  // =====================
  // DIAGRAM - MULTIPLE START EVENTS
  // =====================

  it('should save diagram with multiple start events', async () => {
    const proc = await createProcess(client, 'FE Multi Start Process');
    const task1 = await createProcess(client, 'FE Multi Start Task 1');
    const task2 = await createProcess(client, 'FE Multi Start Task 2');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'start-1',
          elementType: ProcessElementType.NONE_START_EVENT,
          labels: [{ locale: 'en', text: 'Normal start' }],
          sortOrder: 0,
        },
        {
          elementId: 'start-2',
          elementType: ProcessElementType.NONE_START_EVENT,
          labels: [{ locale: 'en', text: 'Alternative start' }],
          sortOrder: 1,
        },
        {
          elementId: 'task-1',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: task1.key,
          sortOrder: 2,
        },
        {
          elementId: 'task-2',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: task2.key,
          sortOrder: 3,
        },
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          sortOrder: 4,
        },
      ],
      flows: [
        { flowId: 'flow-1', sourceElementId: 'start-1', targetElementId: 'task-1' },
        { flowId: 'flow-2', sourceElementId: 'start-2', targetElementId: 'task-2' },
        { flowId: 'flow-3', sourceElementId: 'task-1', targetElementId: 'end-1' },
        { flowId: 'flow-4', sourceElementId: 'task-2', targetElementId: 'end-1' },
      ],
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);
    expect(res.data.elements.length).toBe(5);

    const startEvents = res.data.elements.filter(
      (e) => e.elementType === ProcessElementType.NONE_START_EVENT,
    );
    expect(startEvents.length).toBe(2);
  });

  // =====================
  // DIAGRAM - EVENT LABELS
  // =====================

  it('should save diagram with labels on all event types', async () => {
    const proc = await createProcess(client, 'FE Event Labels Process');
    const task = await createProcess(client, 'FE Event Labels Task');

    const diagramReq: SaveProcessDiagramRequest = {
      elements: [
        {
          elementId: 'start-1',
          elementType: ProcessElementType.NONE_START_EVENT,
          labels: [{ locale: 'en', text: 'Customer request' }],
          sortOrder: 0,
        },
        {
          elementId: 'task-1',
          elementType: ProcessElementType.TASK,
          linkedProcessKey: task.key,
          sortOrder: 1,
        },
        {
          elementId: 'ie-1',
          elementType: ProcessElementType.INTERMEDIATE_EVENT,
          labels: [{ locale: 'en', text: 'Approval received' }],
          sortOrder: 2,
        },
        {
          elementId: 'end-1',
          elementType: ProcessElementType.NONE_END_EVENT,
          labels: [{ locale: 'en', text: 'Order completed' }],
          sortOrder: 3,
        },
        {
          elementId: 'end-2',
          elementType: ProcessElementType.TERMINATE_END_EVENT,
          labels: [{ locale: 'en', text: 'Order cancelled' }],
          sortOrder: 4,
        },
      ],
      flows: [
        { flowId: 'flow-1', sourceElementId: 'start-1', targetElementId: 'task-1' },
        { flowId: 'flow-2', sourceElementId: 'task-1', targetElementId: 'ie-1' },
        { flowId: 'flow-3', sourceElementId: 'ie-1', targetElementId: 'end-1' },
      ],
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);

    const startEvent = res.data.elements.find((e) => e.elementId === 'start-1');
    expect(startEvent?.labels?.[0].text).toBe('Customer request');

    const endEvent = res.data.elements.find((e) => e.elementId === 'end-1');
    expect(endEvent?.labels?.[0].text).toBe('Order completed');

    const terminateEnd = res.data.elements.find((e) => e.elementId === 'end-2');
    expect(terminateEnd?.labels?.[0].text).toBe('Order cancelled');

    const intermediateEvent = res.data.elements.find((e) => e.elementId === 'ie-1');
    expect(intermediateEvent?.labels?.[0].text).toBe('Approval received');
  });

  // =====================
  // DELETE
  // =====================

  it('should delete process and return 404 on re-fetch', async () => {
    const proc = await createProcess(client, 'FE Deletable Process');

    const delRes = await client.delete(`/processes/${proc.key}`);
    expect(delRes.status).toBe(204);

    const getRes = await client.get(`/processes/${proc.key}`);
    expect(getRes.status).toBe(404);
  });
});
