import { METHODOLOGY_DEFINITIONS, SECTION_TO_METHODOLOGY, ALL_METHODOLOGY_KEYS } from '../context/MethodologyContext';

/**
 * Client-side mirror of the backend `RoleService`. Roles are stored as composite tokens:
 *  - global: `ROLE_USER`, `ROLE_ADMIN`
 *  - methodology-scoped: `ROLE_EDITOR_<M>`, `ROLE_LEAD_<M>` (lead implies editor for the same M)
 *
 * The client gate is intentionally coarse — the backend enforces field-level permission and returns 403.
 * These helpers only decide what UI to optimistically show/enable.
 */

export const ROLE_USER = 'ROLE_USER';
export const ROLE_ADMIN = 'ROLE_ADMIN';
export const ROLE_LEAD_PREFIX = 'ROLE_LEAD_';
export const ROLE_EDITOR_PREFIX = 'ROLE_EDITOR_';

export interface RoleScopes {
  isAdmin: boolean;
  editorMethodologies: Set<string>;
  leadMethodologies: Set<string>;
}

export const getRoleScopes = (roles: string[] | undefined | null): RoleScopes => {
  const valid = new Set(ALL_METHODOLOGY_KEYS);
  const editors = new Set<string>();
  const leads = new Set<string>();
  let isAdmin = false;
  for (const token of roles ?? []) {
    if (token === ROLE_ADMIN) {
      isAdmin = true;
    } else if (token.startsWith(ROLE_LEAD_PREFIX)) {
      const m = token.slice(ROLE_LEAD_PREFIX.length);
      if (valid.has(m)) {
        leads.add(m);
        editors.add(m); // lead implies editor for the same methodology
      }
    } else if (token.startsWith(ROLE_EDITOR_PREFIX)) {
      const m = token.slice(ROLE_EDITOR_PREFIX.length);
      if (valid.has(m)) editors.add(m);
    }
  }
  return { isAdmin, editorMethodologies: editors, leadMethodologies: leads };
};

export const isAdmin = (roles: string[] | undefined | null): boolean => getRoleScopes(roles).isAdmin;

export const isLeadFor = (roles: string[] | undefined | null, methodology: string): boolean => {
  const s = getRoleScopes(roles);
  return s.isAdmin || s.leadMethodologies.has(methodology);
};

export const isEditorFor = (roles: string[] | undefined | null, methodology: string): boolean => {
  const s = getRoleScopes(roles);
  return s.isAdmin || s.editorMethodologies.has(methodology);
};

/** Whether the user holds any lead role (or is admin) — used to gate access to the configuration screens. */
export const hasAnyLeadRole = (roles: string[] | undefined | null): boolean => {
  const s = getRoleScopes(roles);
  return s.isAdmin || s.leadMethodologies.size > 0;
};

/** Whether the user holds any editor/lead role (or is admin) — used as the coarse content-edit gate. */
export const hasAnyEditorRole = (roles: string[] | undefined | null): boolean => {
  const s = getRoleScopes(roles);
  return s.isAdmin || s.editorMethodologies.size > 0;
};

/** Methodologies relevant to an entity type (by the sections that type carries). */
const ENTITY_TYPE_METHODOLOGIES: Record<string, string[]> = {
  BUSINESS_ENTITY: ['DATA_GOVERNANCE', 'DDD'],
  BUSINESS_PROCESS: ['PROCESS_GOVERNANCE', 'GDPR', 'DDD', 'BCM'],
  BUSINESS_DOMAIN: ['DDD'],
  ORGANISATIONAL_UNIT: ['TEAM_TOPOLOGIES', 'DDD'],
};

/**
 * Coarse client gate: should we optimistically show edit affordances for this entity type because the user
 * holds an editor/lead role relevant to it? Owners/stewards/admins are handled separately by the caller.
 * Real per-field enforcement happens on the backend (403).
 */
export const canEditEntityTypeByRole = (
  roles: string[] | undefined | null,
  entityType: keyof typeof ENTITY_TYPE_METHODOLOGIES | string,
): boolean => {
  const s = getRoleScopes(roles);
  if (s.isAdmin) return true;
  const relevant = ENTITY_TYPE_METHODOLOGIES[entityType] ?? [];
  return relevant.some((m) => s.editorMethodologies.has(m));
};

/** Methodology that owns a section (for filtering config screens to a lead's scope). */
export const methodologyOfSection = (section: string): string | undefined => SECTION_TO_METHODOLOGY[section];

/** Human label for a methodology key. */
export const methodologyLabel = (key: string): string => METHODOLOGY_DEFINITIONS[key]?.label ?? key;
