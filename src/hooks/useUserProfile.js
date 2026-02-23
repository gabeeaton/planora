// ============================================================
// src/hooks/useUserProfile.js
// Manages the user's academic profile (classes, preferences).
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { subscribeUserProfile, saveUserProfile } from "../services/firebase";
import { cacheUserProfile, loadCachedProfile } from "../services/offlineStorage";

export const useUserProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [firestoreReady, setFirestoreReady] = useState(false);

  useEffect(() => {
    if (!user) { setProfile(null); setLoading(false); setFirestoreReady(false); return; }
    setFirestoreReady(false);

    // Load cache immediately for snappy UI
    loadCachedProfile().then((cached) => {
      if (cached) { setProfile(cached); setLoading(false); }
    });

    const unsubscribe = subscribeUserProfile(user.uid, (freshProfile) => {
      setProfile(freshProfile);
      if (freshProfile) cacheUserProfile(freshProfile);
      setLoading(false);
      setFirestoreReady(true);
    });

    return unsubscribe;
  }, [user]);

  const updateProfile = useCallback(async (data) => {
    if (!user) return;
    await saveUserProfile(user.uid, data);
  }, [user]);

  // True if the user has completed onboarding
  const hasCompletedOnboarding = !!profile?.onboardingComplete;

  // True if user is on Pro plan
  const isPro = !!profile?.isPro;

  return { profile, loading, firestoreReady, updateProfile, hasCompletedOnboarding, isPro };
};