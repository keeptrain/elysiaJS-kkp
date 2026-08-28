export abstract class LoginService {
  static async login(email: string): Promise<boolean> {
    if (email !== 'test@gmail.com') return false;
    return true;
  }
}
