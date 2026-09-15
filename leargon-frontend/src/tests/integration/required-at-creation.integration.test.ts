import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { AxiosInstance } from 'axios';
import { createClient, signupAdmin, signupWithRoles, withToken } from './testClient';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/**
 * "Required at creation": mandatory, creation-capable fields an admin flags are enforced by the create
 * endpoint (422 REQUIRED_AT_CREATION_MISSING with the missing fields), and reported by /creation/targets
 * so the wizard can tell the user up front.
 */
describe('Required at creation', () => {
  let admin: AxiosInstance;
  let editor: AxiosInstance;
  let previousConfig: unknown[];

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const adminAuth = await signupAdmin(admin, {
      email: 'rac-admin@example.com', username: 'racadmin', password: 'password123', firstName: 'RAC', lastName: 'Admin',
    });
    withToken(admin, adminAuth.accessToken);

    editor = createClient(getBackendUrl());
    const editorAuth = await signupWithRoles(editor, {
      email: 'rac-editor@example.com', username: 'raceditor', password: 'password123', firstName: 'RAC', lastName: 'Editor',
    }, ['ROLE_USER', 'ROLE_EDITOR_DATA_GOVERNANCE']);
    withToken(editor, editorAuth.accessToken);

    previousConfig = (await admin.get('/administration/field-configurations')).data;
    const put = await admin.put('/administration/field-configurations', [
      ...(previousConfig as Array<{ entityType: string; fieldName: string }>).filter(
        (e) => !(e.entityType === 'BUSINESS_ENTITY' && e.fieldName === 'descriptions.en'),
      ),
      {
        entityType: 'BUSINESS_ENTITY',
        fieldName: 'descriptions.en',
        visibility: 'SHOWN',
        section: 'CORE',
        maturityLevel: 'BASIC',
        requiredAtCreation: true,
      },
    ]);
    expect(put.status).toBe(200);
  });

  afterAll(async () => {
    // Other suites share the backend — restore the configuration they expect.
    await admin.put('/administration/field-configurations', previousConfig);
  });

  it('round-trips the flag through the field configuration', async () => {
    const all = (await admin.get('/administration/field-configurations')).data as Array<{
      entityType: string; fieldName: string; requiredAtCreation?: boolean;
    }>;
    expect(all.find((e) => e.entityType === 'BUSINESS_ENTITY' && e.fieldName === 'descriptions.en')?.requiredAtCreation).toBe(true);
  });

  it('refuses a create without the required field with 422 and names it', async () => {
    const res = await editor.post('/business-entities', { names: [{ locale: 'en', text: 'RAC Customer' }] });
    expect(res.status).toBe(422);
    expect(res.data.errorCode).toBe('REQUIRED_AT_CREATION_MISSING');
    expect(res.data.missingFields).toContain('descriptions.en');
  });

  it('accepts the create once the required field is supplied', async () => {
    const res = await editor.post('/business-entities', {
      names: [{ locale: 'en', text: 'RAC Supplier' }],
      descriptions: [{ locale: 'en', text: 'A company we buy from' }],
    });
    expect(res.status).toBe(201);
  });

  it('reports the required fields on the creation targets', async () => {
    const res = await editor.get('/creation/targets', { params: { itemType: 'BUSINESS_ENTITY' } });
    expect(res.data.requiredFields).toContain('descriptions.en');
  });

  it('rejects flagging a field that is not mandatory (400)', async () => {
    const res = await admin.put('/administration/field-configurations', [
      ...(previousConfig as unknown[]),
      {
        entityType: 'BUSINESS_ENTITY',
        fieldName: 'storageLocations',
        visibility: 'SHOWN',
        section: 'DATA_GOVERNANCE',
        maturityLevel: 'BASIC',
        requiredAtCreation: true,
      },
    ]);
    expect(res.status).toBe(400);
  });
});
