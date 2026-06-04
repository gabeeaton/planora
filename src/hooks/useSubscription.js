// ============================================================
// src/hooks/useSubscription.js
// Checks RevenueCat entitlement for active Scholar subscription.
// Falls back to Firestore isPro flag for users who had manual Pro.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { DeviceEventEmitter } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./useAuth";
import { useUserProfile } from "./useUserProfile";
import { configurePurchases, getIsSubscribed, ENTITLEMENT_ID } from "../services/purchases";
import { invalidateTodayFocusCache } from "../services/openai";
import { setProStatus } from "../services/firebase";
import { FEATURE_FLAGS } from "../config";
import Purchases from "react-native-purchases";

export const DEV_SCHOLAR_KEY = "@dev_scholar_override";

export const useSubscription = () => {
  const { user }             = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const [rcSubscribed, setRcSubscribed]      = useState(false);
  const [rcLoading, setRcLoading]            = useState(true);
  const [devOverride, setDevOverride]        = useState(null); // null = no explicit override set

  useEffect(() => {
    if (!FEATURE_FLAGS.DEV_SCHOLAR_OVERRIDE) return;
    AsyncStorage.getItem(DEV_SCHOLAR_KEY).then((v) => {
      if (v === "true") setDevOverride(true);
      else if (v === "false") setDevOverride(false);
      // else: leave as null — defer to real subscription
    });
    const sub = DeviceEventEmitter.addListener("devScholarToggle", (val) => setDevOverride(val));
    return () => sub.remove();
  }, []);

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

  // When RC confirms the subscription has lapsed, sync Firestore so isPro doesn't
  // keep granting access indefinitely after cancellation.
  // Never runs in dev — RC sandbox key can't verify real purchases and would nuke isPro.
  useEffect(() => {
    if (__DEV__) return;
    if (rcLoading || !user?.uid || profile == null) return;
    if (!rcSubscribed && profile.isPro) {
      setProStatus(user.uid, false).catch(() => {});
    }
  }, [rcLoading, rcSubscribed, profile?.isPro, user?.uid]);

  // When devOverride is explicitly set (true/false), it takes full precedence over real subscription
  const hasProAccess = FEATURE_FLAGS.BETA_PRO_UNLOCKED ||
    (devOverride !== null ? devOverride : (rcSubscribed || !!profile?.isPro));

  const prevProRef = useRef(hasProAccess);
  useEffect(() => {
    if (!prevProRef.current && hasProAccess) {
      invalidateTodayFocusCache();
    }
    prevProRef.current = hasProAccess;
  }, [hasProAccess]);

  return {
    isPro: hasProAccess,
    hasProAccess,
    loading,
  };
};
