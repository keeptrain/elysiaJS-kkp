import { describe, expect, it } from 'bun:test';
import {
  buildProductListFromCached,
  getProductListKey,
  LIST_TTL,
  listVersionKey,
} from '../../cache';

describe('unit cache.ts', () => {
  describe('constants', () => {
    it('should have correct LIST_TTL and listVersionKey', () => {
      expect(LIST_TTL).toBe(300);
      expect(listVersionKey).toBe('products:list:version');
    });
  });

  describe('getProductListKey', () => {
    it('should generate key with default values when query params are undefined', () => {
      const key = getProductListKey('1', {});
      expect(key).toBe('products:list:v1:all:all:start:10:all');
    });

    it('should generate key with provided query values', () => {
      const key = getProductListKey('2', {
        type: 'benih',
        organizationId: 5,
        cursor: 'prod_123',
        limit: 20,
      });
      expect(key).toBe('products:list:v2:benih:5:prod_123:20:all');
    });

    it('should include search query in key', () => {
      const key = getProductListKey('3', { q: 'nila' });
      expect(key).toBe('products:list:v3:all:all:start:10:nila');
    });
  });

  describe('buildProductListFromCached', () => {
    it('should parse valid cached json string correctly', () => {
      const mockPayload = {
        items: [
          {
            id: 'p1',
            type: 'benih' as const,
            name: 'Benih Lele',
            slug: 'benih-lele',
            status: 'active' as const,
            stockAssitance: 100,
            priceAssitance: 500,
            stockCommercial: 200,
            priceCommercial: 1000,
            organizationId: 1,
          },
        ],
        nextCursor: 'p1',
      };

      const result = buildProductListFromCached(JSON.stringify(mockPayload));
      expect(result).toEqual(mockPayload);
    });
  });
});
