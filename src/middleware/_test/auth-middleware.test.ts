import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { db } from '@/lib/pg-db';
import { accounts, sessions, users, verifications } from '@/db/auth-schema';
import { app } from '@/index';
import { auth } from '@/lib/auth';
import { TestHelpers } from 'better-auth/plugins';
import { cleanAuthDb } from '@/modules/auth/_test/utils';
import { desc } from 'drizzle-orm';

const base = 'http://localhost:3000';

beforeEach(async () => {
  await cleanAuthDb();
});

describe('auth-middleware ', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  describe('bad path', () => {
    it('get-session null saat belum login', async () => {});
  });

  describe('bad path', () => {});
});
