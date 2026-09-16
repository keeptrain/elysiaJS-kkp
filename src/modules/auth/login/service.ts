import { randomUUIDv7 } from 'bun';
import { db } from '../../../lib/pg-db';
import { sessionStore } from '../../../lib/session-store';
import { resendMailer } from '../../../lib/resend-mailer';
import { otpsTable, usersTable } from '../../../db/schema';
import { generateRandomCode } from '../../../utils/utils';
import { and, eq } from 'drizzle-orm';

export abstract class LoginService {
  static async createSession(
    email: string
  ): Promise<{ token: string; maxAge: number }> {
    const userId = await this.checkUser(email);
    return sessionStore.create(userId);
  }

  // Check if the user exists, if not create a new user and return the user id
  private static async checkUser(email: string): Promise<string> {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email))
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
      .where(
        and(
          eq(otpsTable.email, email),
          eq(otpsTable.code, otp),
          eq(otpsTable.isUsed, 0)
        )
      )
      .limit(1);

    if (!otpRecord) return false;
    return new Date(otpRecord.expiresAt).getTime() > Date.now();
  }

  private static async clearOtps(email: string): Promise<void> {
    await db
      .update(otpsTable)
      .set({ isUsed: 1 })
      .where(eq(otpsTable.email, email));
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
    await sessionStore.delete(sessionToken);
    return true;
  }
}
