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
import type { ProcessVersionResponse } from '@/api/generated/model/processVersionResponse';

let _crossSeq = 0;
const minimalFlow = () => {
  const ts = ++_crossSeq;
  return {
    nodes: [
      { id: `cross-start-${ts}`, position: 0, nodeType: 'START_EVENT' },
      { id: `cross-end-${ts}`, position: 1, nodeType: 'END_EVENT' },
    ],
    tracks: [],
  };
};

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

    // 6. Save flow
    const flowRes = await client.put(`/processes/${proc.key}/flow`, minimalFlow());
    expect(flowRes.status).toBe(200);
    expect(flowRes.data.nodes.length).toBe(2);

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

    // Save flow → FLOW_UPDATE version
    await client.put(`/processes/${proc.key}/flow`, minimalFlow());

    // Check versions
    const versionsRes = await client.get<ProcessVersionResponse[]>(
      `/processes/${proc.key}/versions`,
    );
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.data.length).toBeGreaterThanOrEqual(3);
    expect(versionsRes.data.some((v) => v.changeType === 'CREATE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'TYPE_CHANGE')).toBe(true);
    expect(versionsRes.data.some((v) => v.changeType === 'FLOW_UPDATE')).toBe(true);
  });

  // =====================
  // REFERENTIAL INTEGRITY: DELETE ENTITY → PROCESSES SURVIVE
  // =====================

  it('should delete entity → linked processes still exist, entity removed from inputs', async () => {
    const proc = await createProcess(client, 'FE Integrity Process A');
    const entity = await createEntity(client, 'FE Integrity Entity A');

    // Link entity as input
    await client.post(`/processes/${proc.key}/inputs`, { entityKey: entity.key });

    // Verify it's linked
    const beforeRes = await client.get(`/processes/${proc.key}`);
    expect(beforeRes.data.inputEntities.length).toBe(1);

    // Delete the entity
    const delRes = await client.delete(`/business-entities/${entity.key}`);
    expect(delRes.status).toBe(204);

    // Entity is gone
    const entityRes = await client.get(`/business-entities/${entity.key}`);
    expect(entityRes.status).toBe(404);

    // Process still exists, entity removed from inputs via DB cascade
    const procRes = await client.get(`/processes/${proc.key}`);
    expect(procRes.status).toBe(200);
    expect((procRes.data.inputEntities ?? []).every((e: { key: string }) => e.key !== entity.key)).toBe(true);
  });

  it('should delete process → input/output entities still exist (not deleted)', async () => {
    const proc = await createProcess(client, 'FE Integrity Process B');
    const inputEnt = await createEntity(client, 'FE Integrity Entity Input');
    const outputEnt = await createEntity(client, 'FE Integrity Entity Output');

    await client.post(`/processes/${proc.key}/inputs`, { entityKey: inputEnt.key });
    await client.post(`/processes/${proc.key}/outputs`, { entityKey: outputEnt.key });

    // Delete the process
    const delRes = await client.delete(`/processes/${proc.key}`);
    expect(delRes.status).toBe(204);

    // Both entities still exist
    const inputRes = await client.get(`/business-entities/${inputEnt.key}`);
    expect(inputRes.status).toBe(200);

    const outputRes = await client.get(`/business-entities/${outputEnt.key}`);
    expect(outputRes.status).toBe(200);
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
