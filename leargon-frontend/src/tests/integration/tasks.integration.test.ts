import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createClient,
  signup,
  signupCreator,
  signupAdmin,
  withToken,
  createEntity,
} from './testClient';
import type { AxiosInstance } from 'axios';

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/**
 * The to-do list is derived from live catalogue data, so these tests set up a real gap (a mandatory
 * field with no value) and then assert who sees it, what dismissing does, and that an administrator
 * can switch the rule off.
 */
describe('Tasks API', () => {
  let ownerClient: AxiosInstance;
  let strangerClient: AxiosInstance;
  let adminClient: AxiosInstance;
  let entityKey: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    ownerClient = createClient(baseUrl);
    strangerClient = createClient(baseUrl);
    adminClient = createClient(baseUrl);

    const adminAuth = await signupAdmin(adminClient, {
      email: 'tasks-admin@example.com',
      username: 'tasksadmin',
      password: 'password123',
      firstName: 'Tasks',
      lastName: 'Admin',
    });
    withToken(adminClient, adminAuth.accessToken);

    // Make the English description mandatory so every entity without one raises a to-do.
    await adminClient.put('/administration/field-configurations', [
      { entityType: 'BUSINESS_ENTITY', fieldName: 'descriptions.en', visibility: 'SHOWN', section: 'CORE', maturityLevel: 'BASIC' },
    ]);

    const ownerAuth = await signupCreator(ownerClient, {
      email: 'tasks-owner@example.com',
      username: 'tasksowner',
      password: 'password123',
      firstName: 'Tasks',
      lastName: 'Owner',
    });
    withToken(ownerClient, ownerAuth.accessToken);

    const strangerAuth = await signup(strangerClient, {
      email: 'tasks-stranger@example.com',
      username: 'tasksstranger',
      password: 'password123',
      firstName: 'Tasks',
      lastName: 'Stranger',
    });
    withToken(strangerClient, strangerAuth.accessToken);

    const entity = await createEntity(ownerClient, 'TaskFixtureEntity');
    entityKey = entity.key;
  });

  afterAll(async () => {
    // Leave the shared backend as we found it for the other specs.
    await adminClient.put('/administration/field-configurations', []);
    await adminClient.put('/administration/task-rules', []);
  });

  // ─── auth guards ───────────────────────────────────────────────────────────

  it('GET /tasks returns 401 without authentication', async () => {
    const res = await createClient(getBackendUrl()).get('/tasks');
    expect(res.status).toBe(401);
  });

  it('GET /tasks/by-owner returns 403 for a non-admin', async () => {
    const res = await ownerClient.get('/tasks/by-owner');
    expect(res.status).toBe(403);
  });

  // ─── derivation ────────────────────────────────────────────────────────────

  it('gives the owner a to-do for the missing mandatory field', async () => {
    const res = await ownerClient.get('/tasks');
    expect(res.status).toBe(200);

    const task = res.data.tasks.find(
      (item: { resourceKey: string; ruleCode: string }) => item.resourceKey === entityKey && item.ruleCode === 'MISSING_MANDATORY_FIELD',
    );
    expect(task).toBeDefined();
    expect(task.priority).toBe('REQUIRED');
    expect(task.fieldName).toBe('descriptions.en');
    expect(task.responsibility).toBe('OWNER');
    expect(task.resourceNames.some((n: { locale: string }) => n.locale === 'en')).toBe(true);
  });

  it('reports progress across the checks that ran', async () => {
    const res = await ownerClient.get('/tasks');
    const summary = res.data.summary;
    expect(summary.checksEvaluated).toBeGreaterThan(0);
    expect(summary.checksPassed).toBe(summary.checksEvaluated - res.data.tasks.filter((t: { dismissed: boolean }) => !t.dismissed).length);
    expect(summary.completionPercentage).not.toBeNull();
  });

  it('does not show the to-do to an unrelated user', async () => {
    const res = await strangerClient.get('/tasks');
    expect(res.status).toBe(200);
    expect(res.data.tasks.filter((t: { resourceKey: string }) => t.resourceKey === entityKey)).toHaveLength(0);
  });

  // ─── dismissal ─────────────────────────────────────────────────────────────

  it('dismisses with a reason and restores again', async () => {
    const list = await ownerClient.get('/tasks');
    const task = list.data.tasks.find((t: { resourceKey: string }) => t.resourceKey === entityKey);
    const taskId = encodeURIComponent(task.id);

    const dismissed = await ownerClient.post(`/tasks/${taskId}/dismissal`, { reason: 'No description needed here' });
    expect(dismissed.status).toBe(200);
    expect(dismissed.data.dismissed).toBe(true);

    const after = await ownerClient.get('/tasks');
    expect(after.data.tasks.find((t: { id: string }) => t.id === task.id)).toBeUndefined();

    const withDismissed = await ownerClient.get('/tasks?includeDismissed=true');
    const hidden = withDismissed.data.tasks.find((t: { id: string }) => t.id === task.id);
    expect(hidden.dismissed).toBe(true);
    expect(hidden.dismissedReason).toBe('No description needed here');

    const restored = await ownerClient.delete(`/tasks/${taskId}/dismissal`);
    expect(restored.status).toBe(204);
    expect((await ownerClient.get('/tasks')).data.tasks.some((t: { id: string }) => t.id === task.id)).toBe(true);
  });

  it('rejects a dismissal without a reason', async () => {
    const list = await ownerClient.get('/tasks');
    const task = list.data.tasks.find((t: { resourceKey: string }) => t.resourceKey === entityKey);
    const res = await ownerClient.post(`/tasks/${encodeURIComponent(task.id)}/dismissal`, { reason: '' });
    expect(res.status).toBe(400);
  });

  it('refuses a dismissal from someone who is not responsible', async () => {
    const list = await ownerClient.get('/tasks');
    const task = list.data.tasks.find((t: { resourceKey: string }) => t.resourceKey === entityKey);
    const res = await strangerClient.post(`/tasks/${encodeURIComponent(task.id)}/dismissal`, { reason: 'Not mine' });
    expect(res.status).toBe(403);
  });

  // ─── configurable rules ────────────────────────────────────────────────────

  it('exposes the rule inventory with basic-tier rules on by default', async () => {
    const res = await ownerClient.get('/administration/task-rules/definitions');
    expect(res.status).toBe(200);
    expect(res.data.length).toBeGreaterThan(5);
    for (const def of res.data) {
      expect(def.enabledByDefault).toBe(def.maturityLevel === 'BASIC');
    }
  });

  it('switching a rule off removes its to-dos, and downgrading changes their priority', async () => {
    await adminClient.put('/administration/task-rules', [
      { ruleCode: 'MISSING_MANDATORY_FIELD', enabled: true, priority: 'RECOMMENDED' },
    ]);
    const downgraded = await ownerClient.get('/tasks');
    expect(
      downgraded.data.tasks.find((t: { resourceKey: string; ruleCode: string }) => t.resourceKey === entityKey && t.ruleCode === 'MISSING_MANDATORY_FIELD').priority,
    ).toBe('RECOMMENDED');

    await adminClient.put('/administration/task-rules', [
      { ruleCode: 'MISSING_MANDATORY_FIELD', enabled: false },
    ]);
    const off = await ownerClient.get('/tasks');
    expect(off.data.tasks.filter((t: { ruleCode: string }) => t.ruleCode === 'MISSING_MANDATORY_FIELD')).toHaveLength(0);

    // restore the default configuration for the remaining assertions
    await adminClient.put('/administration/task-rules', []);
    expect(
      (await ownerClient.get('/tasks')).data.tasks.some((t: { ruleCode: string }) => t.ruleCode === 'MISSING_MANDATORY_FIELD'),
    ).toBe(true);
  });

  it('refuses a rule configuration change from a plain user', async () => {
    const res = await strangerClient.put('/administration/task-rules', [
      { ruleCode: 'MISSING_STEWARD', enabled: true },
    ]);
    expect(res.status).toBe(403);
  });

  it('lists outstanding work by owner for an administrator', async () => {
    const res = await adminClient.get('/tasks/by-owner');
    expect(res.status).toBe(200);
    const bucket = res.data.owners.find((o: { user?: { username: string } }) => o.user?.username === 'tasksowner');
    expect(bucket).toBeDefined();
    expect(bucket.total).toBeGreaterThan(0);
  });
});
