import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TabFABContextValue {
  fabElement: ReactNode | null;
  setFabElement: (el: ReactNode | null) => void;
}

const TabFABContext = createContext<TabFABContextValue>({
  fabElement: null,
  setFabElement: () => {},
});

export function TabFABProvider({ children }: { children: ReactNode }) {
  const [fabElement, setFabElementState] = useState<ReactNode | null>(null);

  const setFabElement = useCallback((el: ReactNode | null) => {
    setFabElementState(el);
  }, []);

  return (
    <TabFABContext.Provider value={{ fabElement, setFabElement }}>
      {children}
    </TabFABContext.Provider>
  );
}

export function useTabFAB() {
  return useContext(TabFABContext);
}
