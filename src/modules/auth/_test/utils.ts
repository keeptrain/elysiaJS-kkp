import type { TestHelpers } from 'better-auth/plugins';
import { db } from '@/lib/pg-db';
import { accounts, sessions, users, verifications } from '@/db/auth-schema';

export async function createUser(test: TestHelpers, email?: string) {
  const user = email ? test.createUser({ email }) : test.createUser();
  await test.saveUser(user);
  return user;
}

export async function authedHeaders(
  test: TestHelpers,
  email?: string | undefined
): Promise<Headers> {
  const user = test.createUser({ email });
  await test.saveUser(user); // save to table on db
  return test.getAuthHeaders({ userId: user.id });
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
