import { redis } from '@/lib/bun-redis';
import type { ListProductsQuery } from './model';

const LIST_PREFIX = 'products:list';
const DETAIL_PREFIX = 'products:detail';

export const LIST_TTL = 300; // 5 minutes
export const DETAIL_TTL = 600; // 10 minutes
export const listVersionKey = `${LIST_PREFIX}:version`;

export function getProductDetailKey(slug: string): string {
  return `${DETAIL_PREFIX}:${slug}`;
}

export function buildProductDetailFromCached(cached: string) {
  return JSON.parse(cached) as {
    id: string;
    type: 'benih' | 'bibit';
    name: string;
    slug: string;
    sku: string;
    status: 'active';
    stockAssitance: number;
    priceAssitance: number;
    stockCommercial: number;
    priceCommercial: number;
    organizationId: number;
    organization: {
      id: number;
      name: string;
      code: string;
    };
  };
}

export async function readDetailCache(slug: string): Promise<string | null> {
  try {
    return await redis.get(getProductDetailKey(slug));
  } catch {
    return null;
  }
}

export async function writeDetailCache(
  slug: string,
  value: unknown
): Promise<void> {
  try {
    await redis.set(
      getProductDetailKey(slug),
      JSON.stringify(value),
      'EX',
      DETAIL_TTL
    );
  } catch {
    // best-effort
  }
}

export async function invalidateProductDetailCache(
  ...slugs: string[]
): Promise<void> {
  if (slugs.length === 0) return;
  try {
    await redis.del(...slugs.map(getProductDetailKey));
  } catch {
    // best-effort
  }
}

export function getProductListKey(
  version: string,
  query: ListProductsQuery
): string {
  const type = query.type ?? 'all';
  const organizationId = query.organizationId ?? 'all';
  const cursor = query.cursor ?? 'start';
  const limit = query.limit ?? 10;
  const q = query.q ? query.q : 'all';
  return `${LIST_PREFIX}:v${version}:${type}:${organizationId}:${cursor}:${limit}:${q}`;
}

export function buildProductListFromCached(cached: string) {
  return JSON.parse(cached) as {
    items: Array<{
      id: string;
      type: 'benih' | 'bibit';
      name: string;
      slug: string;
      status: 'active';
      stockAssitance: number;
      priceAssitance: number;
      stockCommercial: number;
      priceCommercial: number;
      organizationId: number;
    }>;
    nextCursor: string | null;
  };
}

export async function readListCache(
  query: ListProductsQuery
): Promise<string | null> {
  try {
    const version = (await redis.get(listVersionKey)) ?? '1';
    return await redis.get(getProductListKey(version, query));
  } catch {
    return null;
  }
}

export async function writeListCache(
  query: ListProductsQuery,
  value: unknown
): Promise<void> {
  try {
    const version = (await redis.get(listVersionKey)) ?? '1';
    await redis.set(
      getProductListKey(version, query),
      JSON.stringify(value),
      'EX',
      LIST_TTL
    );
  } catch {
    // best-effort
  }
}

export async function invalidateProductListCache(): Promise<void> {
  try {
    await redis.incr(listVersionKey);
  } catch {
    // best-effort
  }
}
