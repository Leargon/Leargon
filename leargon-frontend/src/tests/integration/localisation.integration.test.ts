import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, signupAdmin, withToken, ApiError } from './testClient';
import type { AxiosInstance } from 'axios';
import type { BusinessEntityResponse } from '@/api/generated/model/businessEntityResponse';
import type { OrganisationalUnitResponse } from '@/api/generated/model/organisationalUnitResponse';
import type { ProcessResponse } from '@/api/generated/model/processResponse';
import type { FieldConfigurationDefinition } from '@/api/generated/model/fieldConfigurationDefinition';
import type { LocalizedText } from '@/api/generated/model/localizedText';

/**
 * Every reference from one catalogue item to another is rendered from a `*SummaryResponse`. Those used
 * to carry a single name resolved against a hardcoded `"en"`, so a German reader saw "Logistics" where
 * the catalogue said "Logistik".
 *
 * These tests drive the real HTTP API and assert the shape the UI depends on: each summary carries the
 * full `names` list, and the flat `name` compatibility field follows the tenant's default locale.
 */

function getBackendUrl(): string {
  const url = process.env.E2E_BACKEND_URL;
  if (!url) throw new Error('E2E_BACKEND_URL not set — is globalSetup running?');
  return url;
}

/** German and English, so a single-locale fallback is always visibly wrong. */
function bilingual(en: string, de: string): LocalizedText[] {
  return [
    { locale: 'en', text: en },
    { locale: 'de', text: de },
  ];
}

function textFor(names: LocalizedText[] | undefined, locale: string): string | undefined {
  return names?.find((n) => n.locale === locale)?.text;
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

describe('Localisation of catalogue references', () => {
  let admin: AxiosInstance;
  let entityKey: string;
  let unitKey: string;

  beforeAll(async () => {
    const baseUrl = getBackendUrl();
    admin = createClient(baseUrl);
    const auth = await signupAdmin(admin, {
      email: 'l10n-admin@example.com',
      username: 'l10nadmin',
      password: 'password123',
      firstName: 'L10n',
      lastName: 'Admin',
    });
    admin = withToken(admin, auth.accessToken);

    // German is an active locale on this tenant, so the catalogue can be named in it.
    const locales = await admin.get('/locales?includeInactive=true');
    const hasGerman = (locales.data as Array<{ localeCode: string }>).some((l) => l.localeCode === 'de');
    if (!hasGerman) {
      await post(admin, '/locales', {
        localeCode: 'de',
        displayName: 'Deutsch',
        isActive: true,
        sortOrder: 2,
      });
    }

    const unit = await post<OrganisationalUnitResponse>(admin, '/organisational-units', {
      names: bilingual('Logistics', 'Logistik'),
    });
    unitKey = unit.key;

    const entity = await post<BusinessEntityResponse>(admin, '/business-entities', {
      names: bilingual('Order Line Item', 'Bestellposition'),
    });
    entityKey = entity.key;

    await put(admin, `/business-entities/${entityKey}/owning-unit`, { owningUnitKey: unitKey });
  });

  it('gives an owning unit reference every locale its name is defined in', async () => {
    const res = await admin.get<BusinessEntityResponse>(`/business-entities/${entityKey}`);

    expect(res.status).toBe(200);
    const names = res.data.owningUnit?.names;
    expect(textFor(names, 'de')).toBe('Logistik');
    expect(textFor(names, 'en')).toBe('Logistics');
  });

  it('gives a parent entity reference every locale its name is defined in', async () => {
    const parent = await post<BusinessEntityResponse>(admin, '/business-entities', {
      names: bilingual('Order', 'Bestellung'),
    });
    const child = await post<BusinessEntityResponse>(admin, '/business-entities', {
      names: bilingual('Delivery Note Line', 'Lieferscheinposition'),
    });

    // Re-parenting re-keys the child, so the response is the source of truth for the new key.
    const updated = await put<BusinessEntityResponse>(
      admin,
      `/business-entities/${child.key}/parent`,
      { parentKey: parent.key },
    );

    expect(textFor(updated.parent?.names, 'de')).toBe('Bestellung');
    expect(textFor(updated.parent?.names, 'en')).toBe('Order');
  });

  it('gives a parent process reference every locale its name is defined in', async () => {
    const parent = await post<ProcessResponse>(admin, '/processes', {
      names: bilingual('Order Fulfillment', 'Auftragsabwicklung'),
    });
    const child = await post<ProcessResponse>(admin, '/processes', {
      names: bilingual('Picking', 'Kommissionierung'),
    });

    const updated = await put<ProcessResponse>(admin, `/processes/${child.key}/parent`, {
      parentKey: parent.key,
    });

    expect(textFor(updated.parentProcess?.names, 'de')).toBe('Auftragsabwicklung');
  });

  it('lists entities with their full name list, not just a default-locale string', async () => {
    const res = await admin.get<BusinessEntityResponse[]>('/business-entities');

    expect(res.status).toBe(200);
    const entity = res.data.find((e) => e.key === entityKey);
    expect(textFor(entity?.names, 'de')).toBe('Bestellposition');
  });

  it('localises the field-inventory labels the settings screen renders', async () => {
    const res = await admin.get<FieldConfigurationDefinition[]>(
      '/administration/field-configurations/definitions',
    );

    expect(res.status).toBe(200);
    const dataOwner = res.data.find(
      (d) => d.entityType === 'BUSINESS_ENTITY' && d.fieldName === 'dataOwner',
    );
    // The same table already translates this label for the to-do list; the definitions endpoint used
    // to hand back the raw English one.
    expect(dataOwner?.labels).toBeDefined();
    expect(textFor(dataOwner?.labels, 'de')).toBe('Dateneigentümer');
    expect(textFor(dataOwner?.labels, 'en')).toBe('Data Owner');
  });

  it('stamps a machine-readable errorCode the UI can translate', async () => {
    const res = await admin.get('/business-entities/definitely-not-a-real-key', {
      validateStatus: () => true,
    });

    expect(res.status).toBe(404);
    // Without a code the UI can only echo the server's English sentence.
    expect((res.data as { errorCode?: string }).errorCode).toBeTruthy();
  });

  it('refuses an unauthenticated read of a localised summary', async () => {
    const anonymous = createClient(getBackendUrl());

    const res = await anonymous.get(`/business-entities/${entityKey}`, {
      validateStatus: () => true,
    });

    expect(res.status).toBe(401);
  });
});
