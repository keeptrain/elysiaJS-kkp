// test/index.test.ts
import { describe, expect, it } from 'bun:test';
import { app } from '../../..';

const url = `${process.env.APP_URL}/products`;

describe('products/index Controller', () => {
  it('returns a response', async () => {
    const response = await app.handle(
      new Request(url, {
        method: 'GET',
      })
    );

    expect(response.status).toBe(200);

    const responseBody = await response.json();
    expect(responseBody).toHaveProperty('data');
    expect(Array.isArray(responseBody.data)).toBe(true);
    expect(responseBody).toEqual({
      data: [
        {
          id: expect.any(String),
          name: 'Product 1',
          price: 10.99,
          description: 'This is product 1',
        },
        {
          id: expect.any(String),
          name: 'Product 2',
          price: 19.99,
          description: 'This is product 2',
        },
      ],
    });
  });
});
