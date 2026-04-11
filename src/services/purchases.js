// ============================================================
// src/services/purchases.js
// RevenueCat wrapper — all purchase logic lives here.
// ============================================================

import Purchases, { LOG_LEVEL } from "react-native-purchases";

const API_KEY = "test_ALnfmCuADwhSpHSVMQEzKOaPDMM";

// Product IDs must match App Store Connect exactly
export const PRODUCT_IDS = {
  monthly:  "com.planoraapp.monthly",
  semester: "com.planoraapp.semester",
  annual:   "com.planoraapp.annual",
};

export const ENTITLEMENT_ID = "Planora Pro";

let _configured = false;

export const configurePurchases = (userId) => {
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

// Returns available packages from RevenueCat
export const getOfferings = async () => {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch {
    return [];
  }
};

// Purchase a package — throws on failure/cancellation
export const purchasePackage = async (pkg) => {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  if (!isActive) throw new Error("Purchase completed but entitlement not activated.");
  return customerInfo;
};

// Restore previous purchases
export const restorePurchases = async () => {
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
};
