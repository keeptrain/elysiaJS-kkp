// test/index.test.ts
import { describe, it } from 'bun:test';
import { app } from '../../../..';

const url = `http://localhost:3000/change-password`;

describe('auth/change-password/index Controller', () => {
  describe('success', () => {
    it('returns a response', async () => {
      const a16 = 'a'.repeat(16);
      const res = await app
        .handle(
          new Request(url, {
            method: 'POST',
            headers: { cookie: `session=${a16}` },
          })
        )
        .then((res) => res.text());
      console.log(res);
    });
  });

  describe('validation', () => {});
});
