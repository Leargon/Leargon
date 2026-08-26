import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, signupAdmin, withToken, createOrgUnit, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { GroupedOverviewResponse } from '@/api/generated/model/groupedOverviewResponse';
import type { GroupingOptionsResponse } from '@/api/generated/model/groupingOptionsResponse';

/**
 * The "Group by" control asks the server two things: which dimensions this list offers, and the list
 * bucketed by one of them. Both answers carry rules the client must not second-guess — a dimension
 * withdrawn by a disabled methodology, and the flag that marks an ancestor as context rather than a
 * member of the group.
 */

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

async function post<T>(client: AxiosInstance, path: string, body: unknown): Promise<T> {
  const res = await client.post<T>(path, body);
  if (res.status !== 201 && res.status !== 200) throw new ApiError(res.status, res.data);
  return res.data;
}

async function put<T>(client: AxiosInstance, path: string, body: unknown): Promise<T> {
  const res = await client.put<T>(path, body);
  if (res.status !== 200) throw new ApiError(res.status, res.data);
  return res.data;
}

const named = (en: string) => ({ names: [{ locale: 'en', text: en }] });

describe('Overview grouping', () => {
  let admin: AxiosInstance;

  beforeAll(async () => {
    admin = createClient(getBackendUrl());
    const auth = await signupAdmin(admin, {
      email: 'grouping-admin@example.com',
      username: 'groupingadmin',
      password: 'password123',
      firstName: 'Grouping',
      lastName: 'Admin',
    });
    admin = withToken(admin, auth.accessToken);
  });

  afterAll(async () => {
    // Methodology configuration is global; leave it as found so other suites are unaffected.
    await put(admin, '/administration/methodology-configurations', []);
  });

  it('offers the dimensions an entity list can actually be grouped by', async () => {
    const res = await admin.get<GroupingOptionsResponse>('/overviews/BUSINESS_ENTITY/groupings');

    expect(res.status).toBe(200);
    const keys = res.data.options.map((o) => o.key);
    expect(keys[0]).toBe('NONE');
    expect(keys).toEqual(expect.arrayContaining(['OWNER', 'OWNING_UNIT', 'BOUNDED_CONTEXT', 'DOMAIN']));
  });

  it('offers a service provider only what it carries — it has no owner or owning unit', async () => {
    const res = await admin.get<GroupingOptionsResponse>('/overviews/SERVICE_PROVIDER/groupings');

    const keys = res.data.options.map((o) => o.key);
    expect(keys).toEqual(expect.arrayContaining(['PROVIDER_TYPE', 'PROCESSING_COUNTRY']));
    expect(keys).not.toContain('OWNER');
    expect(keys).not.toContain('OWNING_UNIT');
  });

  it('names the dimensions in the reader’s language', async () => {
    const res = await admin.get<GroupingOptionsResponse>('/overviews/BUSINESS_ENTITY/groupings');

    const owner = res.data.options.find((o) => o.key === 'OWNER');
    expect(owner?.labels.find((l) => l.locale === 'en')?.text).toBe('Owner');
  });

  it('buckets entities under their owning unit, with the unit’s own name as the heading', async () => {
    const unit = await createOrgUnit(admin, 'Grouping Logistics');
    const entity = await post<BusinessEntityResponse>(admin, '/business-entities', named('Grouping Order'));
    await put(admin, `/business-entities/${entity.key}/owning-unit`, { owningUnitKey: unit.key });

    const res = await admin.get<GroupedOverviewResponse>('/overviews/BUSINESS_ENTITY?groupBy=OWNING_UNIT');

    expect(res.status).toBe(200);
    const group = res.data.groups.find((g) => g.key === unit.key);
    expect(group).toBeDefined();
    expect(group?.labels.find((l) => l.locale === 'en')?.text).toBe('Grouping Logistics');
    expect(group?.nodes.map((n) => n.key)).toContain(entity.key);
  });

  it('keeps an ancestor from another group as context rather than as a member', async () => {
    const parentUnit = await createOrgUnit(admin, 'Grouping Sales');
    const childUnit = await createOrgUnit(admin, 'Grouping Support');
    const parent = await post<BusinessEntityResponse>(admin, '/business-entities', named('Grouping Parent'));
    const child = await post<BusinessEntityResponse>(admin, '/business-entities', named('Grouping Child'));
    await put(admin, `/business-entities/${parent.key}/owning-unit`, { owningUnitKey: parentUnit.key });
    await put(admin, `/business-entities/${child.key}/owning-unit`, { owningUnitKey: childUnit.key });
    // Re-parenting re-keys the child, so take the key the server assigns.
    const reparented = await put<BusinessEntityResponse>(admin, `/business-entities/${child.key}/parent`, {
      parentKey: parent.key,
    });

    const res = await admin.get<GroupedOverviewResponse>('/overviews/BUSINESS_ENTITY?groupBy=OWNING_UNIT');

    const supportGroup = res.data.groups.find((g) => g.key === childUnit.key);
    const parentNode = supportGroup?.nodes.find((n) => n.key === parent.key);
    // The parent belongs to Sales, so it is shown only to place the child.
    expect(parentNode?.matchesGroup).toBe(false);
    expect(parentNode?.children.map((n) => n.key)).toContain(reparented.key);
    expect(parentNode?.children.find((n) => n.key === reparented.key)?.matchesGroup).toBe(true);
    // and it is not counted as one of the group's items
    expect(supportGroup?.itemCount).toBe(1);
  });

  it('withdraws the bounded-context grouping when DDD is switched off', async () => {
    await put(admin, '/administration/methodology-configurations', [{ key: 'DDD', enabled: false }]);

    const options = await admin.get<GroupingOptionsResponse>('/overviews/BUSINESS_ENTITY/groupings');
    expect(options.data.options.map((o) => o.key)).not.toContain('BOUNDED_CONTEXT');

    // and asking for it anyway is refused, not quietly honoured
    const grouped = await admin.get('/overviews/BUSINESS_ENTITY?groupBy=BOUNDED_CONTEXT', {
      validateStatus: () => true,
    });
    expect(grouped.status).toBe(400);

    await put(admin, '/administration/methodology-configurations', [{ key: 'DDD', enabled: true }]);
  });

  it('refuses a grouping that does not apply to the resource type', async () => {
    const res = await admin.get('/overviews/SERVICE_PROVIDER?groupBy=OWNER', { validateStatus: () => true });

    expect(res.status).toBe(400);
  });

  it('refuses an unauthenticated caller', async () => {
    const anonymous = createClient(getBackendUrl());

    const res = await anonymous.get('/overviews/BUSINESS_ENTITY?groupBy=OWNER', { validateStatus: () => true });

    expect(res.status).toBe(401);
  });
});
