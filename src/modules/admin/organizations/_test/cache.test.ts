import { beforeEach, describe, expect, it } from 'bun:test';
import type { TestHelpers } from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { organizations, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { redis } from '@/lib/bun-redis';
import { db } from '@/lib/pg-db';
import { organizationService } from '@/modules/admin/organizations/service';
import { cleanAuthDb } from '@/modules/auth/_test/utils';

describe('findMemberByUserId cache-aside', () => {
  let test: TestHelpers;

  beforeEach(async () => {
    const ctx = await auth.$context;
    test = ctx.test;
    await cleanAuthDb();
    await db.delete(userOrganizations);
    await db.delete(organizations);
  });

  async function setupMember(roles: string[] = ['shop_operator']) {
    const email = `cache-${Date.now()}-${Math.random()}@gmail.com`;
    const user = test.createUser({ email });
    await test.saveUser(user);
    const [org] = await db
      .insert(organizations)
      .values({
        id: randomUUIDv7(),
        name: 'UPT Cache',
        code: `UPTC-${Date.now()}-${Math.random()}`,
      })
      .returning();
    await db.insert(userOrganizations).values({
      id: randomUUIDv7(),
      userId: user.id,
      organizationId: org.id,
      position: 'staff',
      roles,
    });
    return { user, org };
  }

  it('populates cache on miss and serves from cache', async () => {
    const { user, org } = await setupMember();

    const miss = await organizationService.findMemberByUserId(user.id);
    expect(miss?.organizationId).toBe(org.id);

    const cached = await redis.get(`member:${user.id}`);
    expect(cached).not.toBeNull();

    const hit = await organizationService.findMemberByUserId(user.id);
    expect(hit?.organizationId).toBe(org.id);
    expect(hit?.roles).toEqual(['shop_operator']);

    await redis.del(`member:${user.id}`);
  });

  it('invalidates cache on role update', async () => {
    const { user, org } = await setupMember();

    await organizationService.findMemberByUserId(user.id);
    expect(await redis.get(`member:${user.id}`)).not.toBeNull();

    await organizationService.updateMemberRole(user.id, org.id, ['shop_admin']);
    expect(await redis.get(`member:${user.id}`)).toBeNull();

    const fresh = await organizationService.findMemberByUserId(user.id);
    expect(fresh?.roles).toEqual(['shop_admin']);

    await redis.del(`member:${user.id}`);
  });

  it('returns null after removeMember', async () => {
    const { user, org } = await setupMember();

    await organizationService.findMemberByUserId(user.id);
    await organizationService.removeMember(user.id, org.id);

    expect(await redis.get(`member:${user.id}`)).toBeNull();
    const gone = await organizationService.findMemberByUserId(user.id);
    expect(gone).toBeNull();
  });
});
