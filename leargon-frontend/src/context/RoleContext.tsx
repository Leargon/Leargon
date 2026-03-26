import React, { createContext, useContext, useCallback, useState } from 'react';
import { useAuth } from './AuthContext';
import { useUpdateProfile } from '../api/generated/user/user';
import { UpdateProfileRequestPreferredRole } from '../api/generated/model';

export type Role = 'compliance' | 'architecture' | 'operations' | 'admin';

const SESSION_KEY = 'leargon_role_override';

function serverRoleToRole(serverRole: string | undefined | null): Role | null {
  switch (serverRole) {
    case 'COMPLIANCE':
      return 'compliance';
    case 'ARCHITECTURE':
      return 'architecture';
    case 'OPERATIONS':
      return 'operations';
    case 'ADMIN':
      return 'admin';
    default:
      return null;
  }
}

function defaultRoleForUser(roles: string[] | undefined): Role {
  if (roles?.includes('ROLE_ADMIN')) return 'admin';
  return 'operations';
}

interface RoleContextValue {
  role: Role;
  setRole: (r: Role, temporary?: boolean) => Promise<void>;
  clearTemporaryRole: () => void;
  isTemporary: boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'operations',
  setRole: async () => {},
  clearTemporaryRole: () => {},
  isTemporary: false,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateUser } = useAuth();
  const updateProfileMutation = useUpdateProfile();

  const [sessionOverride, setSessionOverride] = useState<Role | null>(
    () => sessionStorage.getItem(SESSION_KEY) as Role | null,
  );

  const persistedRole =
    serverRoleToRole(user?.preferredRole) ?? defaultRoleForUser(user?.roles ?? []);
  const role: Role = sessionOverride ?? persistedRole;
  const isTemporary = sessionOverride !== null;

  const setRole = useCallback(
    async (r: Role, temporary = false) => {
      if (temporary) {
        sessionStorage.setItem(SESSION_KEY, r);
        setSessionOverride(r);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        setSessionOverride(null);
        const serverRole = r.toUpperCase() as UpdateProfileRequestPreferredRole;
        const response = await updateProfileMutation.mutateAsync({
          data: { preferredRole: serverRole },
        });
        if ('id' in response.data) {
          updateUser(response.data);
        }
      }
    },
    [updateProfileMutation, updateUser],
  );

  const clearTemporaryRole = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSessionOverride(null);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, clearTemporaryRole, isTemporary }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);
