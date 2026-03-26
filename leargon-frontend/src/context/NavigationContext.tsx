import React, { createContext, useContext } from 'react';
import { useRole, type Role } from './RoleContext';

export type Perspective = 'gdpr' | 'governance' | 'ddd' | 'orgdev' | 'bcm';

const ROLE_TO_PERSPECTIVE: Record<Role, Perspective> = {
  compliance: 'gdpr',
  architecture: 'ddd',
  operations: 'orgdev',
  admin: 'governance',
};

export function roleToPerspective(role: Role): Perspective {
  return ROLE_TO_PERSPECTIVE[role];
}

interface NavigationContextValue {
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  perspective: 'governance',
  setPerspective: () => {},
});

// Bridge: reads role from RoleContext and derives the perspective.
// Components that call useNavigation().perspective continue to work unchanged.
const NavigationBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useRole();
  const perspective = ROLE_TO_PERSPECTIVE[role];
  return (
    <NavigationContext.Provider value={{ perspective, setPerspective: () => {} }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <NavigationBridge>{children}</NavigationBridge>;
};

export const useNavigation = () => useContext(NavigationContext);
