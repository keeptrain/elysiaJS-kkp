import { tursoDb } from '../../../lib/turso-db';

export abstract class LoginService {
  private static userRepository: UserRepository;

  private static async verifyOtp(email: string): Promise<boolean> {
    if (email !== 'test@gmail.com') return false;
    return true;
  }

  private static async sendingOtp(email: string): Promise<boolean> {
    if (email !== 'test@gmail.com') return false;
    return true;
  }

  static async login(email: string): Promise<boolean> {
    return true;
  }

  static async logout(sessionToken: string): Promise<boolean> {
    return true;
  }
}

class UserRepository {
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
}
