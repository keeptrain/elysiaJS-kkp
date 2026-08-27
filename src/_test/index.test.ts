// test/index.test.ts
import { beforeAll, describe, expect, it } from 'bun:test';
import { testApp } from '..';

const url = process.env.APP_URL || 'http://localhost:3000';

beforeAll(() => {});

describe('Elysia', () => {
  it('returns a response', async () => {
    const response = await testApp.handle(new Request(url));
    expect(response.status).toBe(200);

    const response1 = await testApp.handle(new Request(url));
    expect(response1.status).toBe(429);
  });
});
