import assert from "node:assert/strict";
import test from "node:test";
import type { BillingStatus, FamilyPlan } from "@prisma/client";
import { getFamilyLimits, shouldShowMobileAds } from "./billing";

const family = (plan: FamilyPlan, billingStatus: BillingStatus, subscriptionPeriodEnd: Date | null = null) => ({
  plan, billingStatus, subscriptionPeriodEnd,
});

test("ads follow server entitlements, including cancellation, grace periods, and grandfathering", () => {
  const cases = [
    { family: family("FREE", "NONE"), ads: true },
    { family: family("MONTHLY", "ACTIVE"), ads: false },
    { family: family("YEARLY", "ACTIVE", new Date("2999-01-01")), ads: false },
    { family: family("MONTHLY", "PAST_DUE", new Date("2999-01-01")), ads: false },
    { family: family("LEGACY", "NONE"), ads: false },
    { family: family("MONTHLY", "INCOMPLETE"), ads: true },
    { family: family("YEARLY", "CANCELED"), ads: true },
    { family: family("MONTHLY", "ACTIVE", new Date("2000-01-01")), ads: true },
  ];
  for (const item of cases) {
    assert.equal(shouldShowMobileAds("ADMIN", item.family), item.ads);
    assert.equal(shouldShowMobileAds("CHILD", item.family), false);
    assert.equal(shouldShowMobileAds("SUPER_USER", item.family), false);
    assert.equal(getFamilyLimits(item.family).maxChildAccounts, item.ads ? 1 : 10);
  }
  assert.equal(shouldShowMobileAds("ADMIN", null), false);
});
