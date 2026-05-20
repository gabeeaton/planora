// ============================================================
// src/services/purchases.js
// RevenueCat wrapper — all purchase logic lives here.
// ============================================================

import Purchases, { LOG_LEVEL } from "react-native-purchases";

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? "";

// Product IDs must match App Store Connect exactly
export const PRODUCT_IDS = {
  monthly:  "com.planoraapp.monthly",
  semester: "com.planoraapp.semester",
  annual:   "com.planoraapp.annual",
};

export const ENTITLEMENT_ID = "Planora Pro";

let _configured = false;

export const configurePurchases = (userId) => {
  if (!API_KEY) return; // skip if key not configured (e.g. missing env var)
  if (_configured) {
    if (userId) Purchases.logIn(userId).catch(() => {});
    return;
  }
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: API_KEY, appUserID: userId ?? null });
  _configured = true;
};

// Returns true if user has active Scholar entitlement
export const getIsSubscribed = async () => {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
};

// Package identifiers in RevenueCat
export const PACKAGE_IDS = {
  monthly:  "$rc_monthly",
  semester: "$rc_six_month",
  annual:   "$rc_annual",
};

// Returns available packages from RevenueCat keyed by plan
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    const map = {};
    pkgs.forEach((pkg) => {
      if (pkg.identifier === PACKAGE_IDS.monthly)  map.monthly  = pkg;
      if (pkg.identifier === PACKAGE_IDS.semester) map.semester = pkg;
      if (pkg.identifier === PACKAGE_IDS.annual)   map.annual   = pkg;
    });
    return map;
  } catch {
    return {};
  }
};

// Purchase a package — throws only on user cancellation or payment failure.
// Entitlement activation can lag in sandbox; we fall back to Firestore isPro flag.
export const purchasePackage = async (pkg) => {
  const { customerInfo: info } = await Purchases.purchasePackage(pkg);

  // Immediate check
  if (info.entitlements.active[ENTITLEMENT_ID] !== undefined) return info;

  // Sandbox / webhook latency — wait 2s and re-fetch
  await new Promise((r) => setTimeout(r, 2000));
  try {
    const fresh = await Purchases.getCustomerInfo();
    if (
      fresh.entitlements.active[ENTITLEMENT_ID] !== undefined ||
      fresh.activeSubscriptions.length > 0
    ) return fresh;
  } catch {}

  // Payment was accepted by StoreKit — return original info.
  // Caller writes isPro to Firestore immediately as the source of truth.
  return info;
};

// Restore previous purchases
export const restorePurchases = async () => {
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
};
