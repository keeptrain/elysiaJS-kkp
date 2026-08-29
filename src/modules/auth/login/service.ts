import { randomUUIDv7 } from 'bun';
import { db, tursoDb } from '../../../lib/turso-db';
import { resendMailer } from '../../../lib/resend-mailer';
import { otpsTable, sessionsTable, usersTable } from '../../../db/schema';
import { generateRandomCode, generateRandomString } from '../../../utils/utils';
import { sql } from 'drizzle-orm';

export abstract class LoginService {
  static async createSession(
    email: string
  ): Promise<{ token: string; maxAge: number }> {
    const userId = await this.checkUser(email);

    const [session] = await db
      .insert(sessionsTable)
      .values({
        userId,
        token: generateRandomString(32),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // expires in 24 hours
      })
      .returning({
        token: sessionsTable.token,
        expiresAt: sessionsTable.expiresAt,
      });

    return {
      token: session.token,
      maxAge: Math.floor(
        (new Date(session.expiresAt).getTime() - Date.now()) / 1000
      ),
    };
  }

  // Check if the user exists, if not create a new user and return the user id
  private static async checkUser(email: string): Promise<string> {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(sql`email = ${email}`)
      .limit(1);

    return (
      user?.id ??
      (await db
        .insert(usersTable)
        .values({ id: randomUUIDv7(), email })
        .returning({ id: usersTable.id })
        .then(([u]) => u.id))
    );
  }

  static async verifyOtp(email: string, otp: string): Promise<boolean> {
    const [otpRecord] = await db
      .select()
      .from(otpsTable)
      .where(sql`email = ${email} AND code = ${otp} AND isUsed = 0`)
      .limit(1);

    if (!otpRecord) return false;
    return new Date(otpRecord.expiresAt).getTime() > Date.now();
  }

  private static async clearOtps(email: string): Promise<void> {
    await db
      .update(otpsTable)
      .set({ isUsed: 1 })
      .where(sql`email = ${email}`);
  }

  static async sendingOtp(email: string): Promise<boolean> {
    // Clear any existing OTPs for the email before sending a new one
    await this.clearOtps(email);

    const code = generateRandomCode().toString();
    const [inserted] = await db
      .insert(otpsTable)
      .values({
        email,
        code,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // expires in 5 minutes
      })
      .returning({ code: otpsTable.code });

    const otpCode = inserted?.code ?? code;
    await resendMailer(email, Number(otpCode));

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
