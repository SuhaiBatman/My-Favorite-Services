import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  addFavorite as addFavoriteRecord,
  listFavorites,
  removeFavorite as removeFavoriteRecord,
  type FavoriteProvider,
} from '../lib/favorites';
import { clearHomePrefetch, peekHomePrefetch } from '../lib/homePrefetch';
import { useAuth } from './AuthContext';

export type FavoriteProfileSnapshot = NonNullable<FavoriteProvider['profiles']>;

type FavoritesContextValue = {
  favorites: FavoriteProvider[];
  isLoading: boolean;
  isFavorite: (providerId: string) => boolean;
  refresh: () => Promise<void>;
  addFavorite: (providerId: string, snapshot?: FavoriteProfileSnapshot) => Promise<void>;
  removeFavorite: (providerId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue>({
  favorites: [],
  isLoading: false,
  isFavorite: () => false,
  refresh: async () => {},
  addFavorite: async () => {},
  removeFavorite: async () => {},
});

function optimisticFavorite(
  providerId: string,
  snapshot: FavoriteProfileSnapshot
): FavoriteProvider {
  return {
    id: `optimistic-${providerId}`,
    provider_id: providerId,
    created_at: new Date().toISOString(),
    profiles: snapshot,
  };
}

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const userId = user?.id ?? session?.user?.id ?? null;
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    const rows = await listFavorites(userId);
    setFavorites(rows);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    const cached = peekHomePrefetch(userId);
    if (cached) {
      setFavorites(cached.favorites);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    void refresh()
      .catch((error) => {
        console.error('FavoritesContext initial load:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, refresh]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((favorite) => favorite.provider_id)),
    [favorites]
  );

  const isFavorite = useCallback(
    (providerId: string) => favoriteIds.has(providerId),
    [favoriteIds]
  );

  const addFavorite = useCallback(
    async (providerId: string, snapshot?: FavoriteProfileSnapshot) => {
      if (!userId) throw new Error('Not signed in');

      let didOptimisticallyAdd = false;
      setFavorites((current) => {
        if (current.some((favorite) => favorite.provider_id === providerId)) {
          return current;
        }
        if (!snapshot) return current;
        didOptimisticallyAdd = true;
        return [optimisticFavorite(providerId, snapshot), ...current];
      });

      try {
        await addFavoriteRecord(providerId, userId);
        clearHomePrefetch();
        await refresh();
      } catch (error) {
        if (didOptimisticallyAdd) {
          setFavorites((current) =>
            current.filter((favorite) => favorite.provider_id !== providerId)
          );
        }
        throw error;
      }
    },
    [refresh, userId]
  );

  const removeFavorite = useCallback(
    async (providerId: string) => {
      if (!userId) throw new Error('Not signed in');

      let removedFavorite: FavoriteProvider | null = null;
      let removedIndex = -1;
      setFavorites((current) => {
        const index = current.findIndex((favorite) => favorite.provider_id === providerId);
        if (index === -1) return current;
        removedFavorite = current[index];
        removedIndex = index;
        return current.filter((favorite) => favorite.provider_id !== providerId);
      });

      if (removedIndex === -1) return;

      try {
        await removeFavoriteRecord(providerId, userId);
        clearHomePrefetch();
      } catch (error) {
        if (removedFavorite) {
          const favoriteToRestore = removedFavorite;
          setFavorites((current) => {
            if (current.some((favorite) => favorite.provider_id === providerId)) {
              return current;
            }
            const next = [...current];
            next.splice(Math.min(removedIndex, next.length), 0, favoriteToRestore);
            return next;
          });
        }
        throw error;
      }
    },
    [userId]
  );

  const value = useMemo(
    () => ({
      favorites,
      isLoading,
      isFavorite,
      refresh,
      addFavorite,
      removeFavorite,
    }),
    [favorites, isLoading, isFavorite, refresh, addFavorite, removeFavorite]
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
