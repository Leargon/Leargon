import React, { createContext, useContext, useMemo } from 'react';
import { useRole, type Role } from './RoleContext';

const ROLE_TO_VISIBLE_SECTIONS: Record<Role, ReadonlySet<string>> = {
  compliance:   new Set(),
  architecture: new Set(['splitDomains', 'conwaysLawAlignment', 'conwaysLawMisalignments', 'bottleneckTeams', 'wronglyPlacedTeams']),
  operations:   new Set(['orgUnitProcessLoad', 'bottleneckTeams', 'wronglyPlacedTeams']),
  admin:        new Set(['userOwnershipWorkload']),
};

interface PerspectiveContextValue {
  /** Returns true if the given insight section ID is visible for the current role. */
  isInPerspective: (sectionId: string) => boolean;
}

const PerspectiveContext = createContext<PerspectiveContextValue>({
  isInPerspective: () => true,
});

export const PerspectiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useRole();

  const isInPerspective = useMemo(
    () => (sectionId: string) => {
      const visible = ROLE_TO_VISIBLE_SECTIONS[role];
      if (visible.size === 0) return false;
      return visible.has(sectionId);
    },
    [role],
  );

  return (
    <PerspectiveContext.Provider value={{ isInPerspective }}>
      {children}
    </PerspectiveContext.Provider>
  );
};

export const usePerspective = () => useContext(PerspectiveContext);
