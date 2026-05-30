import React, { createContext, useCallback, useContext, useState } from 'react';
import { clearHomePrefetch } from '../lib/homePrefetch';

export type OnboardingCelebrationRole = 'user' | 'employee' | 'business';

export type OnboardingCelebrationPayload = {
  firstName: string;
  role: OnboardingCelebrationRole;
};

type OnboardingCelebrationContextType = {
  isCelebrating: boolean;
  setIsCelebrating: (value: boolean) => void;
  celebration: OnboardingCelebrationPayload | null;
  showCelebration: (payload: OnboardingCelebrationPayload) => void;
  hideCelebration: () => void;
};

const OnboardingCelebrationContext = createContext<OnboardingCelebrationContextType>({
  isCelebrating: false,
  setIsCelebrating: () => {},
  celebration: null,
  showCelebration: () => {},
  hideCelebration: () => {},
});

export function OnboardingCelebrationProvider({ children }: { children: React.ReactNode }) {
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [celebration, setCelebration] = useState<OnboardingCelebrationPayload | null>(null);

  const showCelebration = useCallback((payload: OnboardingCelebrationPayload) => {
    setCelebration(payload);
    setIsCelebrating(true);
  }, []);

  const hideCelebration = useCallback(() => {
    setCelebration(null);
    setIsCelebrating(false);
    clearHomePrefetch();
  }, []);

  return (
    <OnboardingCelebrationContext.Provider
      value={{
        isCelebrating,
        setIsCelebrating,
        celebration,
        showCelebration,
        hideCelebration,
      }}
    >
      {children}
    </OnboardingCelebrationContext.Provider>
  );
}

export function useOnboardingCelebration() {
  return useContext(OnboardingCelebrationContext);
}
