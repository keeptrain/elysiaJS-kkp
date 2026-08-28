import { randomUUIDv7 } from 'bun';
import { db, tursoDb } from '../../../lib/turso-db';
import { resendMailer } from '../../../lib/resend-mailer';
import { otpsTable } from '../../../db/schema';
import { generateRandomCode } from '../../../utils/utils';
import { sql } from 'drizzle-orm';

export abstract class LoginService {
  private static userRepository: UserRepository;

  private static async verifyOtp(email: string): Promise<boolean> {
    if (email !== 'test@gmail.com') return false;
    return true;
  }

  private static async clearOtps(email: string): Promise<void> {
    await db
      .update(otpsTable)
      .set({ isUsed: 1 })
      .where(sql`email = ${email}`);
  }

  private static async sendingOtp(email: string): Promise<boolean> {
    // Clear any existing OTPs for the email before sending a new one
    await this.clearOtps(email);

    const expires = await db
      .insert(otpsTable)
      .values({
        email,
        code: generateRandomCode().toString(),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // expires in 5 minutes
      })
      .returning({ code: otpsTable.code });

    await resendMailer(email, Number(expires));

    return true;
  }

  static async login(email: string): Promise<boolean> {
    await this.sendingOtp(email);

    return true;
  }

  static async logout(sessionToken: string): Promise<boolean> {
    return true;
  }
}

abstract class UserRepository {
  static async getId(email: string): Promise<string | null> {
    const existingUser = await tursoDb.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });

    if (existingUser.rows.length === 0) {
      return null;
    } else {
      const row: any = existingUser.rows[0];
      return (row.id ?? row[0]) as string;
    }
  }

  // id is generated in the service, so we don't need to generate it here
  static async create(email: string): Promise<string | null> {
    const user = await tursoDb.execute({
      sql: 'INSERT INTO users (id, email) VALUES (?, ?) ON CONFLICT(email) DO NOTHING RETURNING id',
      args: [randomUUIDv7(), email],
    });

    if (user.rows.length === 0 && user.rowsAffected === 0) {
      return null;
    }

    const row: any = user.rows[0];
    return (row.id ?? row[0]) as string;
  }
}
