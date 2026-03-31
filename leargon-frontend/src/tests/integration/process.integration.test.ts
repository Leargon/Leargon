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
import type { BoundedContextResponse } from '@/api/generated/model/boundedContextResponse';
import type { AxiosInstance } from 'axios';
import type { SaveProcessDiagramRequest } from '@/api/generated/model/saveProcessDiagramRequest';
import type { ProcessDiagramResponse } from '@/api/generated/model/processDiagramResponse';
import type { ProcessVersionResponse } from '@/api/generated/model/processVersionResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { VersionDiffResponse } from '@/api/generated/model/versionDiffResponse';

const MINIMAL_BPMN_XML =
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="start-1" /><bpmn:task id="task-1" /><bpmn:endEvent id="end-1" /><bpmn:sequenceFlow id="flow-1" sourceRef="start-1" targetRef="task-1" /><bpmn:sequenceFlow id="flow-2" sourceRef="task-1" targetRef="end-1" /></bpmn:process></bpmn:definitions>';

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

    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };

    const putRes = await client.put<ProcessDiagramResponse>(
      `/processes/${mainProc.key}/diagram`,
      diagramReq,
    );
    expect(putRes.status).toBe(200);
    expect(putRes.data.bpmnXml).toBeTruthy();

    // GET should return the saved diagram
    const getRes = await client.get<ProcessDiagramResponse>(
      `/processes/${mainProc.key}/diagram`,
    );
    expect(getRes.data.bpmnXml).toBeTruthy();
  });

  it('should save diagram with gateway and labels', async () => {
    const proc = await createProcess(client, 'FE Gateway Process');

    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);
    expect(res.data.bpmnXml).toBeTruthy();
  });

  // =====================
  // DIAGRAM - VALIDATION
  // =====================

  it('should accept diagram with empty bpmnXml', async () => {
    const proc = await createProcess(client, 'FE No Start Process');

    const res = await client.put(
      `/processes/${proc.key}/diagram`,
      { bpmnXml: '' },
    );
    expect(res.status).toBe(200);
  });

  // =====================
  // VERSION HISTORY
  // =====================

  it('should include DIAGRAM_UPDATE in version history', async () => {
    const proc = await createProcess(client, 'FE Version Diagram');

    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
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

    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);
    expect(res.data.bpmnXml).toBeTruthy();
  });

  // =====================
  // DIAGRAM - EVENT LABELS
  // =====================

  it('should save diagram with labels on all event types', async () => {
    const proc = await createProcess(client, 'FE Event Labels Process');

    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };

    const res = await client.put<ProcessDiagramResponse>(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(res.status).toBe(200);
    expect(res.data.bpmnXml).toBeTruthy();
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

  it('should block deletion of process that has child processes (400)', async () => {
    const parent = await createProcess(client, 'FE Parent Process');
    const child = await createProcess(client, 'FE Child Process', { parentProcessKey: parent.key });
    expect(child.parentProcess?.key).toBe(parent.key);

    // Attempt to delete parent while child exists → 400
    const delRes = await client.delete(`/processes/${parent.key}`);
    expect(delRes.status).toBe(400);

    // Parent still exists
    const getRes = await client.get(`/processes/${parent.key}`);
    expect(getRes.status).toBe(200);

    // Cleanup: delete child first, then parent
    await client.delete(`/processes/${child.key}`);
    await client.delete(`/processes/${parent.key}`);
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

  it('should assign bounded context to process', async () => {
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
    const bc = await adminClient.post<BoundedContextResponse>(
      `/business-domains/${domain.key}/bounded-contexts`,
      { names: [{ locale: 'en', text: 'FE Process Sales Domain BC' }] },
    );
    const proc = await createProcess(client, 'FE Domain Process');

    const res = await client.put(`/processes/${proc.key}/bounded-context`, {
      boundedContextKey: bc.data.key,
    });
    expect(res.status).toBe(200);
    expect(res.data.boundedContext.key).toBe(bc.data.key);
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
    expect(versionsRes.data[0].changeSummary).toContain('PUBLIC_TASK');
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
    expect(res.data.purpose ?? null).toBeNull();
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
    expect(res.data.securityMeasures ?? null).toBeNull();
  });

});
