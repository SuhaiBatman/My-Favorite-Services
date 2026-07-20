import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import {
  hasPaidPlanMetadata,
  isStoreReviewerAccount,
} from '../constants/dev';
import {
  addCustomerInfoUpdateListener,
  configureRevenueCat,
  getBasicExpiration,
  getCustomerInfo,
  hasBasicEntitlement,
  logInRevenueCat,
  logOutRevenueCat,
} from '../lib/revenueCatService';

type RevenueCatContextValue = {
  isReady: boolean;
  isLoading: boolean;
  customerInfo: CustomerInfo | null;
  /** Active Basic entitlement (monthly or yearly), or store-reviewer paid override. */
  hasBasicAccess: boolean;
  /** ISO expiration for Basic, or null if lifetime / reviewer override / none. */
  basicExpiresAt: string | null;
  refreshCustomerInfo: () => Promise<CustomerInfo | null>;
  lastError: string | null;
};

const RevenueCatContext = createContext<RevenueCatContextValue>({
  isReady: false,
  isLoading: true,
  customerInfo: null,
  hasBasicAccess: false,
  basicExpiresAt: null,
  refreshCustomerInfo: async () => null,
  lastError: null,
});

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const userEmail = session?.user?.email ?? null;
  const userMeta = (session?.user?.user_metadata ?? null) as Record<string, unknown> | null;

  const reviewerPaid = isStoreReviewerAccount({ email: userEmail, userId });
  const metadataPaid = hasPaidPlanMetadata(userMeta);
  const forcePaidAccess = reviewerPaid || metadataPaid;

  const [isReady, setIsReady] = useState(Platform.OS === 'web' || forcePaidAccess);
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web' && !forcePaidAccess);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshCustomerInfo = useCallback(async () => {
    if (Platform.OS === 'web') {
      return null;
    }
    try {
      const info = await getCustomerInfo();
      setCustomerInfo(info);
      setLastError(null);
      return info;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load subscription status';
      setLastError(message);
      return null;
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setIsLoading(true);
      const result = await configureRevenueCat(userId);
      if (cancelled) return;

      if (!result.configured) {
        // Store reviewers / metadata-paid accounts still get access without RC.
        if (forcePaidAccess) {
          setIsReady(true);
          setLastError(null);
        } else {
          setLastError(result.error ?? 'RevenueCat is not configured');
          setIsReady(false);
        }
        setIsLoading(false);
        return;
      }

      try {
        if (userId) {
          const info = await logInRevenueCat(userId);
          if (!cancelled) setCustomerInfo(info);
        } else {
          await refreshCustomerInfo();
        }
        if (!cancelled) {
          setIsReady(true);
          setLastError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLastError(error instanceof Error ? error.message : 'RevenueCat login failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshCustomerInfo, forcePaidAccess]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isReady) return;

    const removeListener = addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    return removeListener;
  }, [isReady]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isReady) return;

    if (!userId) {
      void logOutRevenueCat()
        .then((info) => setCustomerInfo(info))
        .catch(() => setCustomerInfo(null));
    }
  }, [userId, isReady]);

  const value = useMemo<RevenueCatContextValue>(() => {
    const rcAccess = customerInfo ? hasBasicEntitlement(customerInfo) : false;
    const hasAccess = forcePaidAccess || rcAccess;
    return {
      isReady: forcePaidAccess ? true : isReady,
      isLoading: forcePaidAccess ? false : isLoading,
      customerInfo,
      hasBasicAccess: hasAccess,
      basicExpiresAt: forcePaidAccess
        ? null
        : customerInfo
          ? getBasicExpiration(customerInfo)
          : null,
      refreshCustomerInfo,
      lastError: forcePaidAccess ? null : lastError,
    };
  }, [
    isReady,
    isLoading,
    customerInfo,
    refreshCustomerInfo,
    lastError,
    forcePaidAccess,
  ]);

  return (
    <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextValue {
  return useContext(RevenueCatContext);
}
