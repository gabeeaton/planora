const { getTrialInfo } = require("../src/utils/trialHelpers");

describe("getTrialInfo", () => {
  test("no package → no trial", () => {
    expect(getTrialInfo(undefined)).toEqual({ hasTrial: false, trialDays: null });
    expect(getTrialInfo(null)).toEqual({ hasTrial: false, trialDays: null });
  });

  test("package with no introductoryPrice → no trial (already used it)", () => {
    const pkg = { product: { introductoryPrice: null } };
    expect(getTrialInfo(pkg)).toEqual({ hasTrial: false, trialDays: null });
  });

  test("package with 7-day trial → hasTrial true, trialDays 7", () => {
    const pkg = { product: { introductoryPrice: { periodUnit: "DAY", periodNumberOfUnits: 7 } } };
    expect(getTrialInfo(pkg)).toEqual({ hasTrial: true, trialDays: 7 });
  });

  test("package with 14-day trial → trialDays reads from product", () => {
    const pkg = { product: { introductoryPrice: { periodUnit: "DAY", periodNumberOfUnits: 14 } } };
    expect(getTrialInfo(pkg)).toEqual({ hasTrial: true, trialDays: 14 });
  });

  test("package with non-day trial period → falls back to 7 days", () => {
    // e.g. a 1-week trial represented as WEEK unit
    const pkg = { product: { introductoryPrice: { periodUnit: "WEEK", periodNumberOfUnits: 1 } } };
    expect(getTrialInfo(pkg)).toEqual({ hasTrial: true, trialDays: 7 });
  });

  test("package with introductoryPrice but missing periodNumberOfUnits → fallback 7", () => {
    const pkg = { product: { introductoryPrice: { periodUnit: "DAY", periodNumberOfUnits: 0 } } };
    expect(getTrialInfo(pkg)).toEqual({ hasTrial: true, trialDays: 7 });
  });
});
