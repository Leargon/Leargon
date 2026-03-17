import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signup,
  signupAdmin,
  withToken,
  createProcess,
  createDomain,
  createOrgUnit,
  createClassification,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { SaveProcessDiagramRequest } from '@/api/generated/model/saveProcessDiagramRequest';
import type { ProcessDiagramResponse } from '@/api/generated/model/processDiagramResponse';
import type { ProcessVersionResponse } from '@/api/generated/model/processVersionResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { VersionDiffResponse } from '@/api/generated/model/versionDiffResponse';
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

  // =====================
  // UPDATE OWNER
  // =====================

  it('should change process owner', async () => {
    const newOwnerAuth = await signup(createClient(getBackendUrl()), {
      email: 'fe-proc-newowner@example.com',
      username: 'feprocnewowner',
      password: 'password123',
      firstName: 'New',
      lastName: 'Owner',
    });

    const proc = await createProcess(client, 'FE Ownership Process');

    const res = await client.put(`/processes/${proc.key}/owner`, {
      processOwnerUsername: 'feprocnewowner',
    });
    expect(res.status).toBe(200);
    expect(res.data.processOwner.username).toBe('feprocnewowner');

    // Verify new owner can edit
    const ownerClient = createClient(getBackendUrl());
    withToken(ownerClient, newOwnerAuth.accessToken);
    const editRes = await ownerClient.put(
      `/processes/${res.data.key}/descriptions`,
      [{ locale: 'en', text: 'Owner edited this' }],
    );
    expect(editRes.status).toBe(200);

    // Verify old owner gets 403
    const forbiddenRes = await client.put(
      `/processes/${res.data.key}/descriptions`,
      [{ locale: 'en', text: 'Should fail' }],
    );
    expect(forbiddenRes.status).toBe(403);
  });

  // =====================
  // UPDATE CODE
  // =====================

  it('should update process code and recompute key', async () => {
    const proc = await createProcess(client, 'FE Code Update Process');

    const res = await client.put(`/processes/${proc.key}/code`, {
      code: 'FE-NEW-CODE',
    });
    expect(res.status).toBe(200);
    expect(res.data.code).toBe('FE-NEW-CODE');
    expect(res.data.key).toBe('fe-new-code');
  });

  // =====================
  // UPDATE TYPE
  // =====================

  it('should update process type', async () => {
    const proc = await createProcess(client, 'FE Typed Process');

    const res = await client.put(`/processes/${proc.key}/type`, {
      processType: 'OPERATIONAL_CORE',
    });
    expect(res.status).toBe(200);
    expect(res.data.processType).toBe('OPERATIONAL_CORE');
  });

  it('should clear process type when set to null', async () => {
    const proc = await createProcess(client, 'FE Nullable Type Process', {
      processType: 'SUPPORT',
    });

    const res = await client.put(`/processes/${proc.key}/type`, {
      processType: null,
    });
    expect(res.status).toBe(200);
    expect(res.data.processType ?? null).toBeNull();
  });

  // =====================
  // ASSIGN DOMAIN
  // =====================

  it('should assign business domain to process', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-proc-domain@example.com',
      username: 'feprocdomain',
      password: 'password123',
      firstName: 'Domain',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const domain = await createDomain(adminClient, 'FE Process Sales Domain');
    const proc = await createProcess(client, 'FE Domain Process');

    const res = await client.put(`/processes/${proc.key}/domain`, {
      businessDomainKey: domain.key,
    });
    expect(res.status).toBe(200);
    expect(res.data.businessDomain.key).toBe(domain.key);
  });

  // =====================
  // ASSIGN EXECUTING UNITS
  // =====================

  it('should assign executing organisational units to process', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-proc-execunits@example.com',
      username: 'feprocexecunits',
      password: 'password123',
      firstName: 'Exec',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
    const unit = await createOrgUnit(adminClient, 'FE Executing Unit');
    const proc = await createProcess(client, 'FE Executing Units Process');

    const res = await client.put(`/processes/${proc.key}/executing-units`, {
      keys: [unit.key],
    });
    expect(res.status).toBe(200);
    expect(res.data.executingUnits?.some((u: { key: string }) => u.key === unit.key)).toBe(true);
  });

  it('should clear executing units when set to empty array', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-proc-clearunits@example.com',
      username: 'feprocclearunits',
      password: 'password123',
      firstName: 'Clear',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);
    const unit = await createOrgUnit(adminClient, 'FE Detach Executing Unit');
    const proc = await createProcess(client, 'FE Clear Executing Units Process');

    await client.put(`/processes/${proc.key}/executing-units`, {
      keys: [unit.key],
    });

    const res = await client.put(`/processes/${proc.key}/executing-units`, {
      keys: [],
    });
    expect(res.status).toBe(200);
    expect(res.data.executingUnits?.length ?? 0).toBe(0);
  });

  // =====================
  // ASSIGN CLASSIFICATIONS
  // =====================

  it('should assign classification to process', async () => {
    const adminClient = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(adminClient, {
      email: 'fe-proc-classif@example.com',
      username: 'feprocclassif',
      password: 'password123',
      firstName: 'Classif',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    const classif = await createClassification(
      adminClient,
      'FE Process Priority',
      'BUSINESS_PROCESS',
      [
        { key: 'critical', names: [{ locale: 'en', text: 'Critical' }] },
        { key: 'low', names: [{ locale: 'en', text: 'Low' }] },
      ],
    );
    const proc = await createProcess(client, 'FE Classified Process');

    const res = await client.put(
      `/processes/${proc.key}/classifications`,
      [{ classificationKey: classif.key, valueKey: 'critical' }],
    );
    expect(res.status).toBe(200);
    expect(res.data.classificationAssignments.length).toBe(1);
    expect(res.data.classificationAssignments[0].classificationKey).toBe(classif.key);
    expect(res.data.classificationAssignments[0].valueKey).toBe('critical');
  });

  // =====================
  // VERSION DIFF
  // =====================

  it('should return version diff between versions', async () => {
    const proc = await createProcess(client, 'FE Diff Process');

    // Update names to create version 2
    const updateRes = await client.put(`/processes/${proc.key}/names`, [
      { locale: 'en', text: 'FE Diff Process Updated' },
    ]);
    const updatedKey = updateRes.data.key;

    const diffRes = await client.get<VersionDiffResponse>(
      `/processes/${updatedKey}/versions/2/diff`,
    );
    expect(diffRes.status).toBe(200);
    expect(diffRes.data.versionNumber).toBe(2);
    expect(diffRes.data.previousVersionNumber).toBe(1);
    expect(diffRes.data.changes.length).toBeGreaterThan(0);
    const nameChange = diffRes.data.changes.find((c) => c.field.includes('name'));
    expect(nameChange).toBeTruthy();
  });

  it('should return 404 for diff of non-existent version', async () => {
    const proc = await createProcess(client, 'FE Diff 404 Process');

    const res = await client.get(`/processes/${proc.key}/versions/999/diff`);
    expect(res.status).toBe(404);
  });

  // =====================
  // LEGAL BASIS
  // =====================

  it('should set legal basis on a process', async () => {
    const proc = await createProcess(client, 'FE Legal Basis Process');

    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/legal-basis`, {
      legalBasis: 'CONTRACT',
    });
    expect(res.status).toBe(200);
    expect(res.data.legalBasis).toBe('CONTRACT');
  });

  it('should update legal basis to a different value', async () => {
    const proc = await createProcess(client, 'FE Update Legal Basis Process');

    await client.put(`/processes/${proc.key}/legal-basis`, { legalBasis: 'CONSENT' });
    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/legal-basis`, {
      legalBasis: 'LEGITIMATE_INTEREST',
    });
    expect(res.status).toBe(200);
    expect(res.data.legalBasis).toBe('LEGITIMATE_INTEREST');
  });

  it('should clear legal basis when set to null', async () => {
    const proc = await createProcess(client, 'FE Clear Legal Basis Process');

    await client.put(`/processes/${proc.key}/legal-basis`, { legalBasis: 'CONTRACT' });
    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/legal-basis`, {
      legalBasis: null,
    });
    expect(res.status).toBe(200);
    expect(res.data.legalBasis ?? null).toBeNull();
  });

  it('should return legal basis in GET process response', async () => {
    const proc = await createProcess(client, 'FE Get Legal Basis Process');

    await client.put(`/processes/${proc.key}/legal-basis`, { legalBasis: 'LEGAL_OBLIGATION' });
    const res = await client.get<ProcessResponse>(`/processes/${proc.key}`);
    expect(res.status).toBe(200);
    expect(res.data.legalBasis).toBe('LEGAL_OBLIGATION');
  });

  it('should return 403 when non-owner sets legal basis', async () => {
    const proc = await createProcess(client, 'FE Legal Basis Forbidden Process');

    const otherClient = createClient(getBackendUrl());
    const otherAuth = await signup(otherClient, {
      email: 'fe-legal-other@example.com',
      username: 'felegalother',
      password: 'password123',
      firstName: 'Other',
      lastName: 'User',
    });
    withToken(otherClient, otherAuth.accessToken);

    const res = await otherClient.put(`/processes/${proc.key}/legal-basis`, {
      legalBasis: 'CONSENT',
    });
    expect(res.status).toBe(403);
  });

  it('should return 404 when setting legal basis on unknown process', async () => {
    const res = await client.put(`/processes/non-existent-proc/legal-basis`, {
      legalBasis: 'CONSENT',
    });
    expect(res.status).toBe(404);
  });

  it('should record version entry when legal basis is set', async () => {
    const proc = await createProcess(client, 'FE Legal Basis Version Process');

    await client.put(`/processes/${proc.key}/legal-basis`, { legalBasis: 'PUBLIC_TASK' });
    const versionsRes = await client.get<ProcessVersionResponse[]>(
      `/processes/${proc.key}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.length).toBe(2);
    expect(versionsRes.data[1].changeSummary).toContain('PUBLIC_TASK');
  });

  // =====================
  // PURPOSE
  // =====================

  it('should set purpose on a process', async () => {
    const proc = await createProcess(client, 'FE Purpose Set Process');

    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/purpose`, {
      purpose: 'To manage billing data for corporate clients',
    });
    expect(res.status).toBe(200);
    expect(res.data.purpose).toBe('To manage billing data for corporate clients');
  });

  it('should clear purpose when set to null', async () => {
    const proc = await createProcess(client, 'FE Purpose Clear Process');

    await client.put(`/processes/${proc.key}/purpose`, { purpose: 'Initial purpose' });
    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/purpose`, {
      purpose: null,
    });
    expect(res.status).toBe(200);
    expect(res.data.purpose).toBeNull();
  });

  it('should return 403 when non-owner sets purpose', async () => {
    const proc = await createProcess(client, 'FE Purpose Forbidden Process');

    const otherClient = createClient(getBackendUrl());
    const otherAuth = await signup(otherClient, {
      email: 'fe-purpose-other@example.com',
      username: 'fepurposeother',
      password: 'password123',
      firstName: 'Other',
      lastName: 'User',
    });
    withToken(otherClient, otherAuth.accessToken);

    const res = await otherClient.put(`/processes/${proc.key}/purpose`, { purpose: 'Unauthorized' });
    expect(res.status).toBe(403);
  });

  // =====================
  // SECURITY MEASURES
  // =====================

  it('should set security measures on a process', async () => {
    const proc = await createProcess(client, 'FE Security Measures Set Process');

    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/security-measures`, {
      securityMeasures: 'Encryption at rest, access control lists, audit logging',
    });
    expect(res.status).toBe(200);
    expect(res.data.securityMeasures).toBe('Encryption at rest, access control lists, audit logging');
  });

  it('should clear security measures when set to null', async () => {
    const proc = await createProcess(client, 'FE Security Measures Clear Process');

    await client.put(`/processes/${proc.key}/security-measures`, {
      securityMeasures: 'Initial measures',
    });
    const res = await client.put<ProcessResponse>(`/processes/${proc.key}/security-measures`, {
      securityMeasures: null,
    });
    expect(res.status).toBe(200);
    expect(res.data.securityMeasures).toBeNull();
  });

  it('should return 403 when non-owner sets security measures', async () => {
    const proc = await createProcess(client, 'FE Security Measures Forbidden Process');

    const otherClient = createClient(getBackendUrl());
    const otherAuth = await signup(otherClient, {
      email: 'fe-security-other@example.com',
      username: 'fesecurityother',
      password: 'password123',
      firstName: 'Other',
      lastName: 'User',
    });
    withToken(otherClient, otherAuth.accessToken);

    const res = await otherClient.put(`/processes/${proc.key}/security-measures`, {
      securityMeasures: 'Unauthorized measures',
    });
    expect(res.status).toBe(403);
  });
});
