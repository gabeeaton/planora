// ============================================================
// src/hooks/useSubscription.js
// Checks RevenueCat entitlement for active Scholar subscription.
// Falls back to Firestore isPro flag for users who had manual Pro.
// ============================================================

import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";
import { configurePurchases, getIsSubscribed, ENTITLEMENT_ID } from "../services/purchases";
import Purchases from "react-native-purchases";

export const useSubscription = () => {
  const { user }             = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [rcSubscribed, setRcSubscribed]      = useState(false);
  const [rcLoading, setRcLoading]            = useState(true);

  useEffect(() => {
    if (!user) { setRcSubscribed(false); setRcLoading(false); return; }

    // Log user into RevenueCat so their purchases are associated
    configurePurchases(user.uid);

    // Check current entitlement status
    getIsSubscribed().then((subscribed) => {
      setRcSubscribed(subscribed);
      setRcLoading(false);
    }).catch(() => setRcLoading(false));

    // Listen for real-time entitlement updates (e.g. after purchase)
    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setRcSubscribed(info.entitlements.active[ENTITLEMENT_ID] !== undefined);
    });

    return () => { if (typeof listener === "function") listener(); else listener?.remove?.(); };
  }, [user?.uid]);

  const loading = profileLoading || rcLoading;

  // Active if RevenueCat says so OR Firestore isPro flag is set (legacy)
  // Beta: grant Pro to all users during TestFlight testing
  const BETA_PRO_UNLOCKED = true;
  const hasProAccess = BETA_PRO_UNLOCKED || rcSubscribed || !!profile?.isPro;

  return {
    isPro: hasProAccess,
    hasProAccess,
    loading,
  };
};
