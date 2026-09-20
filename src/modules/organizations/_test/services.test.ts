import { beforeEach, describe, expect, it } from 'bun:test';
import { randomUUIDv7 } from 'bun';
import type { TestHelpers } from 'better-auth/plugins';
import { reset, seed } from 'drizzle-seed';
import { auth } from '@/lib/auth';
import { db } from '@/lib/pg-db';
import { organizations, userOrganizations } from '@/db/schema';
import { cleanAuthDb } from '@/modules/auth/_test/utils';
import { organizationService } from '@/modules/organizations/service';
import { createMembers, createOrganization } from './utils';

describe('Organization Service', () => {
  let test: TestHelpers;

  beforeEach(async () => {
    test = (await auth.$context).test;
    await cleanAuthDb();
    await reset(db, { organizations, userOrganizations });
  });

  it('lists members with the default limit and next cursor', async () => {
    const { organizationId, members } = await createMembers(test, 3);

    const result = await organizationService.listMembers(
      { organizationId, userId: members[0].user.id },
      { limit: 2 }
    );

    expect(result.items).toHaveLength(2);
    expect(result.items.map((member) => member.id)).toEqual([
      members[0].member.id,
      members[1].member.id,
    ]);
    expect(result.nextCursor).toBe(members[1].member.id);
  });

  it('lists the next page after the cursor', async () => {
    const { organizationId, members } = await createMembers(test, 3);

    const result = await organizationService.listMembers(
      { organizationId, userId: members[0].user.id },
      { cursor: members[1].member.id, limit: 2 }
    );

    expect(result.items.map((member) => member.id)).toEqual([
      members[2].member.id,
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('returns an empty page for an organization without members', async () => {
    const { id: organizationId } =
      await createOrganization('Empty Organization');

    const result = await organizationService.listMembers(
      { organizationId, userId: randomUUIDv7() },
      {}
    );

    expect(result).toEqual({ items: [], nextCursor: null });
  });

  it('returns a member detail by user id', async () => {
    const { members } = await createMembers(test, 1);

    expect(
      organizationService.detailMember(members[0].user.id)
    ).resolves.toEqual(members[0].member);
  });
});
