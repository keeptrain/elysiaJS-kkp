import { Cookie, Elysia, status } from 'elysia';
import { models } from './model';
import { LoginService } from './service';
import { tursoDb } from '../../../lib/turso-db';
import { randomUUIDv7 } from 'bun';

export const loginRoute = '/login' as const;

export const loginApp = new Elysia().post(
  loginRoute,
  async ({ body }) => {
    const { email } = body;

    const isLoginSuccessful = await LoginService.login(email);

    const args = [randomUUIDv7(), email];

    try {
      await tursoDb.execute({
        sql: 'INSERT INTO users (id, email) VALUES (?,?)',
        args,
      });
    } catch (err: any) {
      return {
        error: err,
      };
    }

    if (!isLoginSuccessful) {
      return {
        message: 'Invalid email or password',
      };
    }

    return {
      message: `Login successful for email: ${email}`,
    };
  },
  {
    body: models.body,
  }
);
