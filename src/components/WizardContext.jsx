import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * WIZARD CONTEXT
 * 
 * Tracks user progress through the linear onboarding wizard:
 * Map → Role → Auth → Onboarding → Verify → NDA → Matching → Room
 * 
 * Used for pre-auth state (before profile exists) and to track current step.
 */

const WizardContext = createContext(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
}

export function WizardProvider({ children }) {
  // Load from sessionStorage on mount
  const [selectedState, setSelectedState] = useState(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('wizard_state') || null;
  });

  const [selectedRole, setSelectedRole] = useState(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('wizard_role') || null;
  });

  // Persist to sessionStorage
  useEffect(() => {
    if (selectedState) {
      sessionStorage.setItem('wizard_state', selectedState);
    } else {
      sessionStorage.removeItem('wizard_state');
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedRole) {
      sessionStorage.setItem('wizard_role', selectedRole);
    } else {
      sessionStorage.removeItem('wizard_role');
    }
  }, [selectedRole]);

  // Clear wizard state (used after profile sync)
  const clearWizard = () => {
    setSelectedState(null);
    setSelectedRole(null);
    sessionStorage.removeItem('wizard_state');
    sessionStorage.removeItem('wizard_role');
  };

  const value = {
    selectedState,
    setSelectedState,
    selectedRole,
    setSelectedRole,
    clearWizard
  };

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  );
}

export default WizardContext;