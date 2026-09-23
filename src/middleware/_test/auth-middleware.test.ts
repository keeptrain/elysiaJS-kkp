import { beforeAll, beforeEach, describe } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { reset } from 'drizzle-seed';
import { auths } from '@/db/auth-schema';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';

beforeEach(async () => {
  await reset(db, { ...auths });
});

describe('auth-middleware ', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });
});
