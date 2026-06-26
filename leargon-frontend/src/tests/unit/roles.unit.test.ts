import { describe, it, expect } from 'vitest';
import {
  getRoleScopes,
  isAdmin,
  isLeadFor,
  isEditorFor,
  hasAnyLeadRole,
  hasAnyEditorRole,
  canEditEntityTypeByRole,
} from '../../utils/roles';

describe('roles util — client mirror of the backend RoleService', () => {
  it('parses admin', () => {
    expect(isAdmin(['ROLE_USER', 'ROLE_ADMIN'])).toBe(true);
    expect(isAdmin(['ROLE_USER'])).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it('lead implies editor for the same methodology', () => {
    const scopes = getRoleScopes(['ROLE_USER', 'ROLE_LEAD_GDPR', 'ROLE_EDITOR_DDD']);
    expect(scopes.leadMethodologies).toEqual(new Set(['GDPR']));
    expect(scopes.editorMethodologies).toEqual(new Set(['GDPR', 'DDD']));
    expect(isLeadFor(['ROLE_LEAD_GDPR'], 'GDPR')).toBe(true);
    expect(isEditorFor(['ROLE_LEAD_GDPR'], 'GDPR')).toBe(true);
    expect(isLeadFor(['ROLE_LEAD_GDPR'], 'DDD')).toBe(false);
  });

  it('ignores unknown methodology tokens', () => {
    const scopes = getRoleScopes(['ROLE_EDITOR_NONSENSE', 'ROLE_LEAD_FAKE']);
    expect(scopes.editorMethodologies.size).toBe(0);
    expect(scopes.leadMethodologies.size).toBe(0);
  });

  it('admin is editor and lead for everything', () => {
    expect(isEditorFor(['ROLE_ADMIN'], 'DDD')).toBe(true);
    expect(isLeadFor(['ROLE_ADMIN'], 'BCM')).toBe(true);
    expect(hasAnyLeadRole(['ROLE_ADMIN'])).toBe(true);
    expect(hasAnyEditorRole(['ROLE_ADMIN'])).toBe(true);
  });

  it('hasAnyLeadRole / hasAnyEditorRole reflect scoped roles', () => {
    expect(hasAnyLeadRole(['ROLE_USER', 'ROLE_EDITOR_GDPR'])).toBe(false);
    expect(hasAnyEditorRole(['ROLE_USER', 'ROLE_EDITOR_GDPR'])).toBe(true);
    expect(hasAnyEditorRole(['ROLE_USER'])).toBe(false);
  });

  it('canEditEntityTypeByRole gates by entity type relevance', () => {
    // GDPR is relevant to processes, not to entities
    expect(canEditEntityTypeByRole(['ROLE_EDITOR_GDPR'], 'BUSINESS_PROCESS')).toBe(true);
    expect(canEditEntityTypeByRole(['ROLE_EDITOR_GDPR'], 'BUSINESS_ENTITY')).toBe(false);
    // DATA_GOVERNANCE editor can edit entities
    expect(canEditEntityTypeByRole(['ROLE_EDITOR_DATA_GOVERNANCE'], 'BUSINESS_ENTITY')).toBe(true);
    // admin can edit any type
    expect(canEditEntityTypeByRole(['ROLE_ADMIN'], 'ORGANISATIONAL_UNIT')).toBe(true);
  });
});
