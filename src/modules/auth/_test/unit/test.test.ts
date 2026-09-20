import { auth } from '@/lib/auth';
import type { TestHelpers } from 'better-auth/plugins';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { count, eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { organizations, userOrganizations } from '@/db/schema';
import { cleanAuthDb, createUser } from '../utils';
import { treaty } from '@elysia/eden';
import { app } from '@/index';
import { reset, seed } from 'drizzle-seed';
import * as authSchema from '@/db/auth-schema';
import * as normalSchema from '@/db/schema';

const api = treaty(app).api;

describe('get-session organization', () => {
  const schema = {
    ...authSchema,
    ...normalSchema,
  };
  // let test: TestHelpers;

  // beforeAll(async () => {
  //   const ctx = await auth.$context;
  //   test = ctx.test;
  // });

  beforeEach(async () => {
    await reset(db, schema);
    await seed(db, schema).refine((f) => ({
      users: {
        count: 10,
      },
    }));
  });

  afterEach(async () => {});

  it('test', async () => {
    const lists = await db.$count(schema.users);
    expect(lists).toBe(10);
  });

  // it('returns null organization for a user without membership', async () => {
  //   const user = await createUser(test, `unit-noorg-${Date.now()}@gmail.com`);
  //   const { headers } = await test.login({ userId: user.id });
  //   const sess = (await auth.api.getSession({ headers })) as unknown as {
  //     organization: unknown;
  //   };
  //   expect(sess.organization).toBeNull();
  // });

  // it('skips JOIN for kind admin (no membership needed)', async () => {
  //   const user = await createUser(test, `unit-admin-${Date.now()}@gmail.com`);
  //   await db
  //     .update(users)
  //     .set({ metadata: { kind: 'admin' } })
  //     .where(eq(users.id, user.id));
  //   const { headers } = await test.login({ userId: user.id });
  //   const sess = (await auth.api.getSession({ headers })) as unknown as {
  //     user: { metadata: { kind: string } };
  //     organization: unknown;
  //   };
  //   expect(sess.user.metadata).toEqual({ kind: 'admin' });
  //   expect(sess.organization).toBeNull();
  // });

  // it('shows default response without after-hook', async () => {
  //   const user = await createUser(test, `unit-raw-${Date.now()}@gmail.com`);
  //   const { headers } = await test.login({ userId: user.id });
  //   const sess = await auth.api.getSession({ headers });
  //   console.log(JSON.stringify(sess, null, 2));
  // });
});
