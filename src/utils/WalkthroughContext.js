import { createContext, useContext, useState, useCallback } from "react";

// Separate contexts: components that only call setTarget don't re-render when targets change
const WalkthroughTargetsContext = createContext({});
const WalkthroughSetterContext  = createContext(() => {});

export const useWalkthroughTargets = () => useContext(WalkthroughTargetsContext);
export const useSetWalkthroughTarget = () => useContext(WalkthroughSetterContext);

export const WalkthroughProvider = ({ children }) => {
  const [targets, setTargets] = useState({});

  const setTarget = useCallback((name, rect) => {
    setTargets((prev) => {
      const old = prev[name];
      // Skip update if position hasn't meaningfully changed
      if (old && old.cx === rect.cx && old.cy === rect.cy && old.w === rect.w && old.h === rect.h) return prev;
      return { ...prev, [name]: rect };
    });
  }, []);

  return (
    <WalkthroughSetterContext.Provider value={setTarget}>
      <WalkthroughTargetsContext.Provider value={targets}>
        {children}
      </WalkthroughTargetsContext.Provider>
    </WalkthroughSetterContext.Provider>
  );
};
