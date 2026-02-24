import React, { createContext, useContext, useEffect, useState } from "react";
import { loginUser, registerUser, logoutUser, onAuthChange } from "../services/firebase";
import { cacheUserSession, loadCachedUser, clearCache } from "../services/offlineStorage";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCachedUser().then((cachedUser) => {
      if (cachedUser) setUser(cachedUser);
    });

    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        const userData = { uid: firebaseUser.uid, email: firebaseUser.email };
        setUser(userData);
        cacheUserSession(userData);
      } else {
        setUser(null);
        cacheUserSession(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Registration now logs the user straight in — no email verification gate
  // (Firebase Dynamic Links is shut down, breaking mobile email verification)
  const register = async (email, password) => {
    return await registerUser(email, password);
  };

  return (
    <AuthContext.Provider value={{
      user, loading,
      login: loginUser,
      register,
      logout: async () => { await clearCache(); await logoutUser(); },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};