export abstract class LoginService {
  static async login(email: string): Promise<boolean> {
    if (email !== 'test1@gmail.com') return false;
    return true;
  }
}
