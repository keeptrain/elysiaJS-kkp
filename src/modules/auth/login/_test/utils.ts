import { expect } from 'bun:test';

/**
 * Extracts a cookie value from the response headers.
 * @param header The response headers containing the cookies.
 * @param name The name of the cookie to extract.
 * @returns An object containing the cookie value and maxAge, or null if not found.
 */
export async function getCookie(header: Headers, name: 'session') {
  const cookieHeader = header.get('set-cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  if (!match) return null;
  return {
    value: match[1],
    maxAge: parseInt(cookieHeader.match(/Max-Age=(\d+)/)?.[1] ?? '0', 10),
    httpOnly: /HttpOnly/i.test(cookieHeader),
    secure: /Secure/i.test(cookieHeader),
    sameSite: cookieHeader.match(/SameSite=([^;]+)/i)?.[1] ?? null,
    path: cookieHeader.match(/Path=([^;]+)/i)?.[1] ?? null,
    raw: cookieHeader,
  };
}

/**
 * Expect the cookie value to be defined and have the specified length.
 * @param value The cookie value to check.
 * @param length The expected length of the cookie value.
 */
export async function expectCookieValid(
  cookie: {
    value: string;
    maxAge: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string | null;
    path?: string | null;
    raw?: string;
  } | null,
  length: number = 32
) {
  expect(cookie).not.toBeNull();
  expect(cookie!.value.length).toBe(length);
  expect(cookie!.maxAge).toBeGreaterThan(0);
  expect(cookie!.httpOnly).toBe(true);
  expect(cookie!.secure).toBe(true);
  expect(cookie!.sameSite?.toLowerCase()).toBe('strict');
  expect(cookie!.path).toBe('/');
  // raw header should contain all attributes
  expect(cookie!.raw).toMatch(/HttpOnly/i);
  expect(cookie!.raw).toMatch(/Secure/i);
  expect(cookie!.raw).toMatch(/SameSite=Strict/i);
  expect(cookie!.raw).toMatch(/Path=\//);
  expect(cookie!.raw).toMatch(/Max-Age=/);
}
