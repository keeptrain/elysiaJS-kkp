// test/index.test.ts
import { describe, expect, it } from 'bun:test';
import { testApp } from '../../..';

const url = `${process.env.APP_URL}/products`;

describe('products/index Controller', () => {
  it('returns a response', async () => {
    console.log(url);

    // const data = await response.json();
    // expect(data).toHaveProperty('data');
    // expect(Array.isArray(data.data)).toBe(true);
    // expect(data.data.length).toBeGreaterThan(0);
  });
});
