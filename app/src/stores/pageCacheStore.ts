/**
 * pageCacheStore.ts
 *
 * A lightweight, in-memory page data cache using Zustand.
 * Prevents re-fetching data every time a user navigates back to a previously
 * visited page.
 *
 * - Data is stored per cache key (e.g. the route or a user-scoped key).
 * - A configurable TTL (default: 5 minutes) governs when stale data should
 *   trigger a background refresh.
 * - Pages read the cached value immediately so the UI renders without a full
 *   loading spinner, then silently re-fetch in the background to stay fresh.
 *
 * Usage example:
 *
 *   const { get, set } = usePageCache();
 *
 *   // Read cache first
 *   const cached = get<MyData>('my-page-key');
 *
 *   // If cache is fresh, show it immediately
 *   if (cached.data) setMyState(cached.data);
 *
 *   // If no cache OR cache is stale, fetch (silently if we already have data)
 *   if (!cached.fresh) {
 *     fetchMyData().then((data) => {
 *       setMyState(data);
 *       set('my-page-key', data);
 *     });
 *   }
 */

import { create } from 'zustand';

/** Default cache TTL: 5 minutes */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  ttl: number;
}

interface PageCacheState {
  /** Raw in-memory cache map: key → entry */
  cache: Record<string, CacheEntry<unknown>>;

  /**
   * Get a cached value for the given key.
   *
   * @returns `{ data, fresh }` where `fresh` is true if the entry exists and
   * has not exceeded its TTL. If there is no entry, `data` is `null`.
   */
  get: <T>(key: string) => { data: T | null; fresh: boolean };

  /**
   * Store `data` in the cache under `key` with an optional custom `ttl` (ms).
   * Defaults to `DEFAULT_TTL_MS`.
   */
  set: <T>(key: string, data: T, ttl?: number) => void;

  /** Remove a single cache entry. */
  invalidate: (key: string) => void;

  /** Remove all entries that match a prefix. Useful for clearing page groups. */
  invalidatePrefix: (prefix: string) => void;

  /** Wipe the entire cache (e.g., on logout). */
  clear: () => void;
}

export const usePageCache = create<PageCacheState>((set, get) => ({
  cache: {},

  get: <T>(key: string): { data: T | null; fresh: boolean } => {
    const entry = get().cache[key] as CacheEntry<T> | undefined;
    if (!entry) return { data: null, fresh: false };

    const age = Date.now() - entry.cachedAt;
    const fresh = age < entry.ttl;
    return { data: entry.data, fresh };
  },

  set: <T>(key: string, data: T, ttl: number = DEFAULT_TTL_MS) => {
    set((state) => ({
      cache: {
        ...state.cache,
        [key]: { data, cachedAt: Date.now(), ttl },
      },
    }));
  },

  invalidate: (key: string) => {
    set((state) => {
      const next = { ...state.cache };
      delete next[key];
      return { cache: next };
    });
  },

  invalidatePrefix: (prefix: string) => {
    set((state) => {
      const next = { ...state.cache };
      for (const key of Object.keys(next)) {
        if (key.startsWith(prefix)) delete next[key];
      }
      return { cache: next };
    });
  },

  clear: () => set({ cache: {} }),
}));

