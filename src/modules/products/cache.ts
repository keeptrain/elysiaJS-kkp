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

export async function invalidateProductDetailCache(
  ...slugs: string[]
): Promise<void> {
  if (slugs.length > 0) {
    await redis.del(...slugs.map(getProductDetailKey));
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
  return `${LIST_PREFIX}:v${version}:${type}:${organizationId}:${cursor}:${limit}`;
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

export async function invalidateProductListCache(): Promise<void> {
  await redis.incr(listVersionKey);
}
