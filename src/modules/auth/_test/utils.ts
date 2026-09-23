import type { TestHelpers } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/pg-db';
import { accounts, sessions, users, verifications } from '@/db/auth-schema';

export async function createUser(test: TestHelpers, email?: string) {
  const user = email ? test.createUser({ email }) : test.createUser();
  await test.saveUser(user);
  return user;
}

// User pusat: metadata kind admin (lolos kind macro).
export async function createAdminUser(test: TestHelpers, email?: string) {
  const user = await createUser(test, email);
  await db
    .update(users)
    .set({ metadata: { kind: 'admin' } })
    .where(eq(users.id, user.id));
  return user;
}

async function createUserKind(test: TestHelpers, authorization?: string) {
  const user = await createUser(test);

  return user;
}

export async function adminHeaders(
  test: TestHelpers,
  email?: string
): Promise<Headers> {
  const user = await createAdminUser(test, email);
  const { headers } = await test.login({ userId: user.id });
  return headers;
}

export async function authedHeaders(
  test: TestHelpers,
  email?: string | undefined
): Promise<Headers> {
  const user = test.createUser({ email });
  await test.saveUser(user);
  const { headers } = await test.login({ userId: user.id });
  return headers;
}

export function withJson(headers: Headers): Headers {
  const h = new Headers(headers);
  h.set('Content-Type', 'application/json');
  return h;
}

export async function cleanAuthDb(): Promise<void> {
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verifications);
  await db.delete(users);
}
