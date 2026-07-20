import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOfferings,
  type PurchasesPackage,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import {
  getRevenueCatApiKey,
  REVENUECAT_ENTITLEMENT_BASIC,
} from '../constants/revenuecat';

export type RevenueCatInitResult = { configured: boolean; error?: string };

let configurePromise: Promise<RevenueCatInitResult> | null = null;
let customerInfoListener: ((info: CustomerInfo) => void) | null = null;

export function isPurchasesErrorCode(
  error: unknown,
  code: (typeof PURCHASES_ERROR_CODE)[keyof typeof PURCHASES_ERROR_CODE]
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as PurchasesError).code === code
  );
}

export function getPurchasesErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as PurchasesError).message);
  }
  return 'Something went wrong. Please try again.';
}

export function isUserCancelledPurchase(error: unknown): boolean {
  return isPurchasesErrorCode(error, PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR);
}

function findActiveBasicEntitlement(customerInfo: CustomerInfo) {
  const active = customerInfo.entitlements.active;
  if (active[REVENUECAT_ENTITLEMENT_BASIC]?.isActive === true) {
    return active[REVENUECAT_ENTITLEMENT_BASIC];
  }
  for (const [id, entitlement] of Object.entries(active)) {
    if (entitlement?.isActive === true && id.toLowerCase().includes('basic')) {
      return entitlement;
    }
  }
  return null;
}

export function hasBasicEntitlement(customerInfo: CustomerInfo): boolean {
  return findActiveBasicEntitlement(customerInfo) !== null;
}

export function getBasicExpiration(customerInfo: CustomerInfo): string | null {
  return findActiveBasicEntitlement(customerInfo)?.expirationDate ?? null;
}

export async function configureRevenueCat(
  appUserID?: string | null
): Promise<RevenueCatInitResult> {
  if (Platform.OS === 'web') {
    return { configured: false, error: 'In-app purchases are not available on web.' };
  }

  if (configurePromise) {
    return configurePromise;
  }

  configurePromise = (async () => {
    try {
      if (__DEV__) {
        await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }

      const apiKey = getRevenueCatApiKey();
      if (!apiKey) {
        throw new Error('RevenueCat API key is missing.');
      }
      if (!__DEV__ && apiKey.startsWith('test_')) {
        throw new Error(
          'RevenueCat Test Store key cannot be used in a release build. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS/_ANDROID to a store-specific key.'
        );
      }

      Purchases.configure({
        apiKey,
        appUserID: appUserID ?? undefined,
      });

      return { configured: true };
    } catch (error) {
      console.error('[RevenueCat] configure failed:', error);
      configurePromise = null;
      return { configured: false, error: getPurchasesErrorMessage(error) };
    }
  })();

  return configurePromise;
}

export async function logInRevenueCat(appUserID: string): Promise<CustomerInfo> {
  await configureRevenueCat();
  const { customerInfo } = await Purchases.logIn(appUserID);
  return customerInfo;
}

export async function logOutRevenueCat(): Promise<CustomerInfo> {
  return Purchases.logOut();
}

export async function getCustomerInfo(): Promise<CustomerInfo> {
  await configureRevenueCat();
  return Purchases.getCustomerInfo();
}

export async function hasBasicAccess(): Promise<boolean> {
  try {
    const customerInfo = await getCustomerInfo();
    return hasBasicEntitlement(customerInfo);
  } catch (error) {
    console.warn('[RevenueCat] hasBasicAccess failed:', error);
    return false;
  }
}

export async function getOfferings(): Promise<PurchasesOfferings> {
  await configureRevenueCat();
  return Purchases.getOfferings();
}

export function findPackageByProductId(
  offerings: PurchasesOfferings,
  productId: string
): PurchasesPackage | null {
  const allOfferings = [offerings.current, ...Object.values(offerings.all ?? {})].filter(
    Boolean
  );

  for (const offering of allOfferings) {
    if (!offering) continue;
    for (const pkg of offering.availablePackages) {
      if (pkg.product.identifier === productId) {
        return pkg;
      }
    }
  }
  return null;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export type PresentPaywallOptions = {
  displayCloseButton?: boolean;
};

export async function presentRevenueCatPaywall(
  options: PresentPaywallOptions = {}
): Promise<PAYWALL_RESULT> {
  await configureRevenueCat();
  return RevenueCatUI.presentPaywall({
    displayCloseButton: options.displayCloseButton ?? true,
  });
}

export async function presentPaywallIfNeeded(): Promise<PAYWALL_RESULT> {
  await configureRevenueCat();
  return RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_BASIC,
    displayCloseButton: true,
  });
}

export async function presentCustomerCenter(): Promise<void> {
  await configureRevenueCat();
  await RevenueCatUI.presentCustomerCenter();
}

export function addCustomerInfoUpdateListener(
  listener: (info: CustomerInfo) => void
): () => void {
  customerInfoListener = listener;
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    if (customerInfoListener === listener) {
      customerInfoListener = null;
    }
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

export { PAYWALL_RESULT };
