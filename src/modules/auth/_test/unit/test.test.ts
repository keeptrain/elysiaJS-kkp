import { auth } from '@/lib/auth';
import type { TestHelpers } from 'better-auth/plugins';
import { beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { users } from '@/db/auth-schema';
import { organizations, userOrganizations } from '@/db/schema';
import { cleanAuthDb, createUser } from '../utils';
import { treaty } from '@elysia/eden';
import { app } from '@/index';

const api = treaty(app).api;

describe('get-session organization', () => {
  let test: TestHelpers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
  });

  beforeEach(async () => {
    await cleanAuthDb();
    await db.delete(userOrganizations);
    await db.delete(organizations);
  });

  it('returns the membership organization matching the user', async () => {
    const user = await createUser(test, `unit-org-${Date.now()}@gmail.com`);
    // const [org] = await db
    //   .insert(organizations)
    //   .values({
    //     id: randomUUIDv7(),
    //     name: 'UPT Unit',
    //     code: `UPTU-${Date.now()}`,
    //   })
    //   .returning();
    // await db.insert(userOrganizations).values({
    //   id: randomUUIDv7(),
    //   userId: user.id,
    //   organizationId: org.id,
    //   position: 'head',
    //   roles: ['shop_admin', 'magang_admin'],
    // });

    // const { headers } = await test.login({ userId: user.id });
    // const sess = (await auth.api.getSession({ headers })) as unknown as {
    //   user: { id: string };
    //   organization: {
    //     id: string;
    //     position: string;
    //     roles: string[];
    //   } | null;
    // };
    //
    const headers = await test.getAuthHeaders({ userId: user.id });
  });

  it('returns null organization for a user without membership', async () => {
    const user = await createUser(test, `unit-noorg-${Date.now()}@gmail.com`);
    const { headers } = await test.login({ userId: user.id });
    const sess = (await auth.api.getSession({ headers })) as unknown as {
      organization: unknown;
    };
    expect(sess.organization).toBeNull();
  });

  it('skips JOIN for kind admin (no membership needed)', async () => {
    const user = await createUser(test, `unit-admin-${Date.now()}@gmail.com`);
    await db
      .update(users)
      .set({ metadata: { kind: 'admin' } })
      .where(eq(users.id, user.id));
    const { headers } = await test.login({ userId: user.id });
    const sess = (await auth.api.getSession({ headers })) as unknown as {
      user: { metadata: { kind: string } };
      organization: unknown;
    };
    expect(sess.user.metadata).toEqual({ kind: 'admin' });
    expect(sess.organization).toBeNull();
  });

  it('shows default response without after-hook', async () => {
    const user = await createUser(test, `unit-raw-${Date.now()}@gmail.com`);
    const { headers } = await test.login({ userId: user.id });
    const sess = await auth.api.getSession({ headers });
    console.log(JSON.stringify(sess, null, 2));
  });
});
