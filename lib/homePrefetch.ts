import {
  listProviderUpcomingAppointments,
  listUserUpcomingAppointments,
  type Appointment,
} from './appointments';
import { listFavorites, type FavoriteProvider } from './favorites';
import type { UserRole } from './roles';

export type HomePrefetchVariant = 'user' | 'employee';

export type HomePrefetchPayload = {
  userId: string;
  variant: HomePrefetchVariant;
  favorites: FavoriteProvider[];
  userAppointments: Appointment[];
  providerAppointments?: Appointment[];
};

let cache: HomePrefetchPayload | null = null;

export function homePrefetchVariantForRole(role: UserRole): HomePrefetchVariant {
  return role === 'employee' ? 'employee' : 'user';
}

/** Warm Home tab data while onboarding celebration is visible. */
export async function prefetchHomeData(
  userId: string,
  role: UserRole
): Promise<HomePrefetchPayload> {
  const variant = homePrefetchVariantForRole(role);

  if (variant === 'employee') {
    const [providerAppointments, userAppointments, favorites] = await Promise.all([
      listProviderUpcomingAppointments(userId),
      listUserUpcomingAppointments(userId),
      listFavorites(userId),
    ]);
    cache = {
      userId,
      variant,
      favorites,
      userAppointments,
      providerAppointments,
    };
    return cache;
  }

  const [userAppointments, favorites] = await Promise.all([
    listUserUpcomingAppointments(userId),
    listFavorites(userId),
  ]);
  cache = {
    userId,
    variant,
    favorites,
    userAppointments,
  };
  return cache;
}

/** Read prefetched Home data without clearing (safe if Home remounts). */
export function peekHomePrefetch(userId: string): HomePrefetchPayload | null {
  if (!cache || cache.userId !== userId) return null;
  return cache;
}

export function consumeHomePrefetch(userId: string): HomePrefetchPayload | null {
  if (!cache || cache.userId !== userId) return null;
  const payload = cache;
  cache = null;
  return payload;
}

export function clearHomePrefetch(): void {
  cache = null;
}

