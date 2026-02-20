// ============================================================
// src/hooks/useSubscription.js
// Manages Pro subscription state.
// Currently uses Firestore isPro flag (set manually for beta).
// Wire RevenueCat here later for real payments.
// ============================================================

import { useUserProfile } from "./useUserProfile";

export const useSubscription = () => {
  const { profile, loading } = useUserProfile();

  const isPro         = !!profile?.isPro;
  const trialStart    = profile?.trialStart ? new Date(profile.trialStart) : null;
  const trialDays     = 14;

  const isInTrial = (() => {
    if (!trialStart) return false;
    const daysSinceStart = Math.floor((new Date() - trialStart) / (1000 * 60 * 60 * 24));
    return daysSinceStart <= trialDays;
  })();

  // User can access Pro features if they're on Pro OR in trial
  const hasProAccess = isPro || isInTrial;

  const trialDaysRemaining = (() => {
    if (!trialStart || isPro) return null;
    const days = trialDays - Math.floor((new Date() - trialStart) / (1000 * 60 * 60 * 24));
    return Math.max(0, days);
  })();

  return {
    isPro,
    isInTrial,
    hasProAccess,
    trialDaysRemaining,
    loading,
  };
};
