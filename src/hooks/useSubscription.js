// ============================================================
// src/hooks/useSubscription.js
// Freemium model: free forever, Pro unlocks AI features.
// Wire RevenueCat here for real payments.
// ============================================================

import { useUserProfile } from "./useUserProfile";

export const useSubscription = () => {
  const { profile, loading } = useUserProfile();

  const isPro        = !!profile?.isPro;
  const planType     = profile?.planType ?? "monthly"; // "monthly" | "annual"

  // Simple: Pro = paid. No trial logic.
  const hasProAccess = isPro;

  return {
    isPro,
    hasProAccess,
    planType,
    loading,
  };
};