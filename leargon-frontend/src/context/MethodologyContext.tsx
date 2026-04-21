import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useGetMethodologyConfigurations } from '../api/generated/administration/administration';
import type { MethodologyConfigEntry } from '../api/generated/model';
import { MethodologyConfigEntryKey } from '../api/generated/model';

export interface MethodologyDefinition {
  label: string;
  description: string;
  sections: string[];
  navPaths: string[];
}

export const METHODOLOGY_DEFINITIONS: Record<string, MethodologyDefinition> = {
  DATA_GOVERNANCE: {
    label: 'Data Governance',
    description: 'Track data ownership, stewardship, descriptions, quality rules, and data governance policies.',
    sections: ['DATA_GOVERNANCE', 'DATA_QUALITY'],
    navPaths: [],
  },
  PROCESS_GOVERNANCE: {
    label: 'Process Governance',
    description: 'Manage process descriptions, stewardship, and data flow relationships between processes and entities.',
    sections: ['DATA_FLOW'],
    navPaths: [],
  },
  GDPR: {
    label: 'GDPR / DSG — Legal & Privacy',
    description: 'Manage legal basis, purpose, security measures, cross-border transfers, IT systems, service providers, and DPIA registers.',
    sections: ['GDPR'],
    navPaths: ['/compliance', '/dpia', '/it-systems', '/service-providers'],
  },
  DDD: {
    label: 'Domain-Driven Design',
    description: 'Manage bounded contexts, ubiquitous language, context map, domain events, and strategic vision statements.',
    sections: ['DDD', 'STRATEGIC'],
    navPaths: ['/ubiquitous-language', '/diagrams/context-map', '/diagrams/event-flow'],
  },
  BCM: {
    label: 'Business Continuity Management',
    description: 'Manage capabilities, team insights, and business continuity planning.',
    sections: ['BCM'],
    navPaths: ['/capabilities', '/team-insights'],
  },
  TEAM_TOPOLOGIES: {
    label: 'Team Topologies',
    description: 'Define team ownership, stewardship roles, and organisational unit descriptions.',
    sections: ['DATA_GOVERNANCE'],
    navPaths: [],
  },
};

export const ALL_METHODOLOGY_KEYS = Object.values(MethodologyConfigEntryKey) as string[];

export const SECTION_TO_METHODOLOGY: Partial<Record<string, string>> = {
  DATA_GOVERNANCE: 'DATA_GOVERNANCE',
  DATA_QUALITY: 'DATA_GOVERNANCE',
  DATA_FLOW: 'PROCESS_GOVERNANCE',
  GDPR: 'GDPR',
  DDD: 'DDD',
  STRATEGIC: 'DDD',
  BCM: 'BCM',
};

interface MethodologyContextValue {
  methodologies: MethodologyConfigEntry[];
  isLoading: boolean;
  isMethodologyEnabled: (key: string) => boolean;
  isSectionEnabled: (section: string) => boolean;
  isNavPathEnabled: (path: string) => boolean;
}

const MethodologyContext = createContext<MethodologyContextValue>({
  methodologies: [],
  isLoading: false,
  isMethodologyEnabled: () => true,
  isSectionEnabled: () => true,
  isNavPathEnabled: () => true,
});

export const MethodologyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ROLE_ADMIN') ?? false;

  const { data, isLoading } = useGetMethodologyConfigurations({
    query: { enabled: isAdmin, retry: false },
  });

  const methodologies: MethodologyConfigEntry[] = data?.data ?? [];

  const enabledKeys = useMemo<Set<string>>(() => {
    if (!isAdmin || methodologies.length === 0) {
      return new Set(ALL_METHODOLOGY_KEYS);
    }
    return new Set(
      methodologies.filter((m) => m.enabled).map((m) => m.key as string),
    );
  }, [isAdmin, methodologies]);

  const isMethodologyEnabled = (key: string) => enabledKeys.has(key);

  const isSectionEnabled = (section: string) => {
    const methodology = SECTION_TO_METHODOLOGY[section];
    if (!methodology) return true;
    return enabledKeys.has(methodology);
  };

  const isNavPathEnabled = (path: string) => {
    for (const [key, def] of Object.entries(METHODOLOGY_DEFINITIONS)) {
      if (def.navPaths.includes(path) && !enabledKeys.has(key)) return false;
    }
    return true;
  };

  return (
    <MethodologyContext.Provider value={{ methodologies, isLoading, isMethodologyEnabled, isSectionEnabled, isNavPathEnabled }}>
      {children}
    </MethodologyContext.Provider>
  );
};

export const useMethodology = () => useContext(MethodologyContext);
