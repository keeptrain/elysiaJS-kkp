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

    try {
      // check if user already exists in the database
      const existingUser = await tursoDb.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [email],
      });

      let userId: string;
      if (existingUser.rows.length === 0) {
        userId = randomUUIDv7();
        await tursoDb.execute({
          sql: 'INSERT INTO users (id, email) VALUES (?, ?)',
          args: [userId, email],
        });
      } else {
        // libsql row can be accessed via object or array
        const row: any = existingUser.rows[0];
        userId = (row.id ?? row[0]) as string;
      }

      // create session for the user
      const sessionId = randomUUIDv7();
      const sessionToken = String(
        Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15)
      );
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      await tursoDb.execute({
        sql: 'INSERT INTO sessions (id, user_id, session_token, expires_at) VALUES (?, ?, ?, ?)',
        args: [sessionId, userId, sessionToken, expiresAt],
      });
    } catch (err: any) {
      // log for debug, but don't expose raw error to client in prod
      console.error('[login] db error', err);
      return status(500, { message: 'Internal Server Error' });
    }

    return {
      message: `Login successful for email: ${email}`,
    };
  },
  {
    body: models.body,
  }
);
