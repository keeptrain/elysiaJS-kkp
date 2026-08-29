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
  return match
    ? {
        value: match[1],
        maxAge: parseInt(cookieHeader.match(/Max-Age=(\d+)/)?.[1] ?? '0', 10),
      }
    : null;
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
  },
  length: number = 32
) {
  expect(cookie).toBeDefined();
  expect(cookie.value.length).toBe(length);

  expect(cookie.maxAge).toBeGreaterThan(0);
}
