import { Platform } from 'react-native';

/**
 * RevenueCat entitlement / product identifiers — must match the RevenueCat
 * dashboard (and App Store Connect / Play Console product IDs).
 *
 * Pricing:
 * - Basic monthly: $4.99 / month, 7-day free trial
 * - Basic yearly:  $49.99 / year, 7-day free trial
 *
 * Free trials are configured on the store products (App Store Connect /
 * Google Play), not in this file. Both products unlock the same entitlement.
 */
export const REVENUECAT_ENTITLEMENT_BASIC = 'MFS Basic';

/** Store product identifiers (App Store Connect + Play Console). */
export const REVENUECAT_PRODUCT_MONTHLY = 'mfs_basic_monthly';
export const REVENUECAT_PRODUCT_YEARLY = 'mfs_basic_yearly';

/**
 * Test Store key fallback is dev-only: the RevenueCat native SDK hard-aborts
 * if a `test_` key is used in a Release build. In Release with no env key we
 * return '' so configureRevenueCat fails gracefully instead of crashing.
 */
const DEFAULT_TEST_API_KEY = __DEV__ ? '' : '';

export function getRevenueCatApiKey(): string {
  if (Platform.OS === 'ios') {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ??
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
      DEFAULT_TEST_API_KEY
    );
  }
  if (Platform.OS === 'android') {
    return (
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ??
      process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ??
      DEFAULT_TEST_API_KEY
    );
  }
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? DEFAULT_TEST_API_KEY;
}
