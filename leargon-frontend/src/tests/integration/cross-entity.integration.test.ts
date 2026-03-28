import { describe, it, expect, beforeAll } from 'vitest';
import {
  createClient,
  signupAdmin,
  withToken,
  createEntity,
  createDomain,
  createProcess,
} from './testClient';
import type { AxiosInstance } from 'axios';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { SaveProcessDiagramRequest } from '@/api/generated/model/saveProcessDiagramRequest';
import type { ProcessVersionResponse } from '@/api/generated/model/processVersionResponse';

const MINIMAL_BPMN_XML =
  '<?xml version="1.0" encoding="UTF-8"?><bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn"><bpmn:process id="Process_1" isExecutable="false"><bpmn:startEvent id="start-1" /><bpmn:task id="task-1" /><bpmn:endEvent id="end-1" /><bpmn:sequenceFlow id="flow-1" sourceRef="start-1" targetRef="task-1" /><bpmn:sequenceFlow id="flow-2" sourceRef="task-1" targetRef="end-1" /></bpmn:process></bpmn:definitions>';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

describe('Cross-Entity E2E', () => {
  let client: AxiosInstance;

  beforeAll(async () => {
    client = createClient(getBackendUrl());

    const auth = await signupAdmin(client, {
      email: 'fe-cross-admin@example.com',
      username: 'fecrossadmin',
      password: 'password123',
      firstName: 'Cross',
      lastName: 'Admin',
    });
    withToken(client, auth.accessToken);
  });

  // =====================
  // FULL LIFECYCLE: domain → entities → process → diagram
  // =====================

  it('should perform full lifecycle: domain → entities → process → diagram → verify cross-references', async () => {
    // 1. Create domain
    const domain = await createDomain(client, 'FE Cross Domain');
    expect(domain.key).toBe('fe-cross-domain');

    // 2. Create entities
    const inputEntity = await createEntity(client, 'FE Cross Input');
    const outputEntity = await createEntity(client, 'FE Cross Output');

    // 3. Create bounded context and assign entities to it
    const bcRes = await client.post(
      `/business-domains/${domain.key}/bounded-contexts`,
      { names: [{ locale: 'en', text: 'FE Cross BC' }] },
    );
    const bcKey = bcRes.data.key;

    await client.put(`/business-entities/${inputEntity.key}/bounded-context`, {
      boundedContextKey: bcKey,
    });
    await client.put(`/business-entities/${outputEntity.key}/bounded-context`, {
      boundedContextKey: bcKey,
    });

    // 4. Create process in bounded context
    const proc = await createProcess(client, 'FE Cross Process');
    await client.put(`/processes/${proc.key}/bounded-context`, {
      boundedContextKey: bcKey,
    });

    // 5. Add entities as input/output
    const inputRes = await client.post(`/processes/${proc.key}/inputs`, {
      entityKey: inputEntity.key,
    });
    expect(inputRes.data.inputEntities.length).toBe(1);
    expect(inputRes.data.inputEntities[0].key).toBe(inputEntity.key);

    const outputRes = await client.post(`/processes/${proc.key}/outputs`, {
      entityKey: outputEntity.key,
    });
    expect(outputRes.data.outputEntities.length).toBe(1);
    expect(outputRes.data.outputEntities[0].key).toBe(outputEntity.key);

    // 6. Save diagram
    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };

    const diagramRes = await client.put(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(diagramRes.status).toBe(200);
    expect(diagramRes.data.bpmnXml).toBeTruthy();

    // 7. Verify cross-references: process shows bounded context
    const procRes = await client.get<ProcessResponse>(`/processes/${proc.key}`);
    expect(procRes.data.boundedContext?.key).toBe(bcKey);
  });

  // =====================
  // ON-THE-FLY ENTITY CREATION
  // =====================

  it('should create entity on-the-fly via process input', async () => {
    const proc = await createProcess(client, 'FE OTF Process');

    const res = await client.post(`/processes/${proc.key}/inputs`, {
      createEntity: { names: [{ locale: 'en', text: 'FE OTF Entity' }] },
    });
    expect(res.data.inputEntities.length).toBe(1);
    expect(res.data.inputEntities[0].name).toBe('FE OTF Entity');
  });

  // =====================
  // PROCESS VERSION HISTORY WITH MULTIPLE CHANGE TYPES
  // =====================

  it('should track process version history with multiple change types', async () => {
    // Create process → CREATE version
    const proc = await createProcess(client, 'FE Version History Process');

    // Type change → TYPE_CHANGE version
    await client.put(`/processes/${proc.key}/type`, {
      processType: 'MANAGEMENT',
    });

    // Save diagram → DIAGRAM_UPDATE version
    const diagramReq: SaveProcessDiagramRequest = {
      bpmnXml: MINIMAL_BPMN_XML,
    };
    await client.put(`/processes/${proc.key}/diagram`, diagramReq);

    // Check versions
    const versionsRes = await client.get<ProcessVersionResponse[]>(
      `/processes/${proc.key}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.length).toBeGreaterThanOrEqual(3);
    expect(versionsRes.data.some((v) => v.changeType === 'CREATE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'TYPE_CHANGE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'DIAGRAM_UPDATE')).toBe(true);
  });

  // =====================
  // CASCADE: DELETE DOMAIN → ENTITIES/PROCESSES LOSE DOMAIN REF
  // =====================

  it('should cascade: delete domain → entity and process lose bounded context ref', async () => {
    // Create domain and bounded context
    const domain = await createDomain(client, 'FE Cascade Domain');
    const bcRes = await client.post(
      `/business-domains/${domain.key}/bounded-contexts`,
      { names: [{ locale: 'en', text: 'FE Cascade BC' }] },
    );
    const bcKey = bcRes.data.key;

    // Create entity and process, assign to bounded context
    const entity = await createEntity(client, 'FE Cascade Entity');
    await client.put(`/business-entities/${entity.key}/bounded-context`, {
      boundedContextKey: bcKey,
    });

    const proc = await createProcess(client, 'FE Cascade Process');
    await client.put(`/processes/${proc.key}/bounded-context`, {
      boundedContextKey: bcKey,
    });

    // Delete domain (cascades to bounded contexts)
    const delRes = await client.delete(`/business-domains/${domain.key}`);
    expect(delRes.status).toBe(204);

    // Entity still exists but bounded context is null
    const entityRes = await client.get(`/business-entities/${entity.key}`);
    expect(entityRes.status).toBe(200);
    expect(entityRes.data.boundedContext).toBeFalsy();

    // Process still exists but bounded context is null
    const procRes = await client.get(`/processes/${proc.key}`);
    expect(procRes.status).toBe(200);
    expect(procRes.data.boundedContext).toBeFalsy();
  });
});
