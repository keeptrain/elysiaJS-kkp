import type { UserSchema } from '@/db/auth-schema';
import { userServices } from './service';

export interface UserContract {
  getById: (id: string) => Promise<UserSchema | null>;
  getUserIdByEmail: (email: string) => Promise<string | null>;
  updateUser: (
    userId: string,
    data: Partial<UserSchema>
  ) => Promise<UserSchema[]>;
}

export const userModule: UserContract = {
  async getById(id: string) {
    return userServices.getById(id);
  },
  async getUserIdByEmail(email: string) {
    return userServices.getUserIdByEmail(email);
  },
  async updateUser(userId: string, data: Partial<UserSchema>) {
    return userServices.updateUser(userId, data);
  },
};
