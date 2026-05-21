export const getTrialInfo = (pkg) => {
  const introPrice = pkg?.product?.introductoryPrice;
  if (!introPrice) return { hasTrial: false, trialDays: null };
  const trialDays = introPrice.periodUnit === "DAY" && introPrice.periodNumberOfUnits
    ? introPrice.periodNumberOfUnits
    : 7;
  return { hasTrial: true, trialDays };
};
