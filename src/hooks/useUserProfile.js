// ============================================================
// src/hooks/useUserProfile.js
// Context-based — one Firestore listener shared across all screens.
// ============================================================

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { subscribeUserProfile, saveUserProfile } from "../services/firebase";
import { cacheUserProfile, loadCachedProfile } from "../services/offlineStorage";

const UserProfileContext = createContext(null);

export const UserProfileProvider = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [loading, setLoading]               = useState(true);
  const [firestoreReady, setFirestoreReady] = useState(false);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); setFirestoreReady(false); return; }
    setFirestoreReady(false);

    loadCachedProfile().then((cached) => {
      if (cached) { setProfile(cached); setLoading(false); }
    });

    const unsubscribe = subscribeUserProfile(user.uid, (freshProfile) => {
      setProfile(freshProfile);
      cacheUserProfile(freshProfile ?? null);
      setLoading(false);
      setFirestoreReady(true);
    });

    return unsubscribe;
  }, [user]);

  const updateProfile = useCallback(async (data) => {
    if (!user) return;
    await saveUserProfile(user.uid, data);
  }, [user]);

  const hasCompletedOnboarding = !!profile?.onboardingComplete;
  const isPro = !!profile?.isPro;

  return (
    <UserProfileContext.Provider value={{ profile, loading, firestoreReady, updateProfile, hasCompletedOnboarding, isPro }}>
      {children}
    </UserProfileContext.Provider>
  );
};

export const useUserProfile = () => {
  const ctx = useContext(UserProfileContext);
  if (!ctx) throw new Error("useUserProfile must be used within UserProfileProvider");
  return ctx;
};
