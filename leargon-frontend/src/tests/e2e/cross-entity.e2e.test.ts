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
import { ProcessElementType } from '@/api/generated/model/processElementType';

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

    // 3. Assign entities to domain
    await client.put(`/business-entities/${inputEntity.key}/domain`, {
      businessDomainKey: domain.key,
    });
    await client.put(`/business-entities/${outputEntity.key}/domain`, {
      businessDomainKey: domain.key,
    });

    // 4. Create process in domain
    const proc = await createProcess(client, 'FE Cross Process');
    await client.put(`/processes/${proc.key}/domain`, {
      businessDomainKey: domain.key,
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
    const linkedProc = await createProcess(client, 'FE Cross Linked');
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

    const diagramRes = await client.put(
      `/processes/${proc.key}/diagram`,
      diagramReq,
    );
    expect(diagramRes.status).toBe(200);
    expect(diagramRes.data.elements.length).toBe(3);
    expect(diagramRes.data.flows.length).toBe(2);

    // 7. Verify cross-references: domain should have the entity
    const domainRes = await client.get(`/business-domains/${domain.key}`);
    expect(domainRes.data.assignedEntities.length).toBeGreaterThanOrEqual(2);

    // Verify process shows domain
    const procRes = await client.get<ProcessResponse>(`/processes/${proc.key}`);
    expect(procRes.data.businessDomain?.key).toBe(domain.key);
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
    const linked = await createProcess(client, 'FE Version Linked');
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

  it('should cascade: delete domain → entity and process lose domain ref', async () => {
    // Create domain
    const domain = await createDomain(client, 'FE Cascade Domain');

    // Create entity and process, assign to domain
    const entity = await createEntity(client, 'FE Cascade Entity');
    await client.put(`/business-entities/${entity.key}/domain`, {
      businessDomainKey: domain.key,
    });

    const proc = await createProcess(client, 'FE Cascade Process');
    await client.put(`/processes/${proc.key}/domain`, {
      businessDomainKey: domain.key,
    });

    // Delete domain
    const delRes = await client.delete(`/business-domains/${domain.key}`);
    expect(delRes.status).toBe(204);

    // Entity still exists but domain is null
    const entityRes = await client.get(`/business-entities/${entity.key}`);
    expect(entityRes.status).toBe(200);
    expect(entityRes.data.businessDomain).toBeNull();

    // Process still exists but domain is null
    const procRes = await client.get(`/processes/${proc.key}`);
    expect(procRes.status).toBe(200);
    expect(procRes.data.businessDomain).toBeNull();
  });
});
