import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export type Perspective = 'gdpr' | 'governance' | 'ddd' | 'orgdev';

const STORAGE_KEY = 'leargon_perspective';

// Only routes exclusive to ONE perspective trigger an auto-switch.
// Shared routes (/entities, /processes, /diagrams/entities, /diagrams/processes)
// are intentionally absent so the current perspective is preserved.
const ROUTE_TO_PERSPECTIVE: Record<string, Perspective> = {
  '/compliance': 'gdpr',
  '/data-processors': 'gdpr',
  '/dpia': 'gdpr',
  '/domains': 'ddd',
  '/organisation': 'orgdev',
  '/diagrams/organisation': 'orgdev',
  '/team-insights': 'orgdev',
};

function inferPerspective(pathname: string): Perspective | null {
  for (const [prefix, p] of Object.entries(ROUTE_TO_PERSPECTIVE)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return p;
  }
  return null;
}

interface NavigationContextValue {
  perspective: Perspective;
  setPerspective: (p: Perspective) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  perspective: 'governance',
  setPerspective: () => {},
});

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [perspective, setPerspectiveState] = useState<Perspective>(() => {
    const inferred = inferPerspective(location.pathname);
    if (inferred) return inferred;
    return (sessionStorage.getItem(STORAGE_KEY) as Perspective) ?? 'governance';
  });

  useEffect(() => {
    const inferred = inferPerspective(location.pathname);
    if (inferred && inferred !== perspective) {
      setPerspectiveState(inferred);
      sessionStorage.setItem(STORAGE_KEY, inferred);
    }
  }, [location.pathname]);

  const setPerspective = (p: Perspective) => {
    setPerspectiveState(p);
    sessionStorage.setItem(STORAGE_KEY, p);
  };

  return (
    <NavigationContext.Provider value={{ perspective, setPerspective }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);
