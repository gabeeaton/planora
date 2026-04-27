import { createContext, useContext, useState, useCallback } from "react";

export const WalkthroughContext = createContext({ targets: {}, setTarget: () => {} });

export const useWalkthroughTargets = () => useContext(WalkthroughContext);

export const WalkthroughProvider = ({ children }) => {
  const [targets, setTargets] = useState({});
  const setTarget = useCallback((name, rect) => {
    setTargets((prev) => ({ ...prev, [name]: rect }));
  }, []);
  return (
    <WalkthroughContext.Provider value={{ targets, setTarget }}>
      {children}
    </WalkthroughContext.Provider>
  );
};
