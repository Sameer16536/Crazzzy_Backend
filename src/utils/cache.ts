/**
 * Tag-based In-Memory Cache
 *
 * Strategy:
 *  - Cache GET responses with a TTL (default 5 min) and one or more tags.
 *  - When a mutation happens (create/update/delete), call invalidateTag()
 *    to instantly clear all cached entries that carry that tag.
 *
 * Why in-memory vs Redis:
 *  - Simple, zero external dependencies, sub-millisecond lookup.
 *  - TTL acts as a safety-net fallback if invalidation is somehow missed.
 *  - Good enough for a single Railway instance. If you ever scale to
 *    multiple instances, swap this out for Redis (ioredis) with the same API.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;  // Unix ms
  tags: string[];
}

class InMemoryCache {
  private store = new Map<string, CacheEntry>();

  /** Return cached value or null if missing / expired */
  get(key: string): unknown | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data;
  }

  /** Store a value with tags and TTL (defaults to 5 minutes) */
  set(key: string, data: unknown, tags: string[], ttlMs = 5 * 60 * 1000) {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      tags,
    });
  }

  /**
   * Instantly evict ALL cache entries that carry a given tag.
   * Call this after any create / update / delete mutation.
   *
   * e.g.  invalidateTag('products')  →  clears all product list + detail caches
   */
  invalidateTag(tag: string) {
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.includes(tag)) {
        this.store.delete(key);
      }
    }
    console.log(`[Cache] Invalidated tag: "${tag}" (${this.store.size} entries remaining)`);
  }

  /** Nuke everything — use for emergency / testing */
  clear() {
    this.store.clear();
  }

  /** How many entries are currently cached (for observability) */
  get size() {
    return this.store.size;
  }
}

// Singleton — shared across all requests in this process
export const appCache = new InMemoryCache();

// ── Cache tag constants ───────────────────────────────────────────────────────
// Use these everywhere so tag names never drift between files.
export const CACHE_TAGS = {
  PRODUCTS: 'products',
  CATEGORIES: 'categories',
  SETTINGS: 'settings',
} as const;
