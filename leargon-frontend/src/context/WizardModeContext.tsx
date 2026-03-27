import React, { createContext, useContext, useState } from 'react';

export type WizardMode = 'guided' | 'express';

interface WizardModeContextType {
  mode: WizardMode;
  setMode: (mode: WizardMode) => void;
}

const WizardModeContext = createContext<WizardModeContextType>({
  mode: 'guided',
  setMode: () => {},
});

const STORAGE_KEY = 'leargon_wizard_mode';

export const WizardModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<WizardMode>(
    () => (localStorage.getItem(STORAGE_KEY) as WizardMode) || 'guided',
  );

  const setMode = (m: WizardMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY, m);
  };

  return (
    <WizardModeContext.Provider value={{ mode, setMode }}>
      {children}
    </WizardModeContext.Provider>
  );
};

export const useWizardMode = () => useContext(WizardModeContext);
