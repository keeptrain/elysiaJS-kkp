import { treaty } from '@elysia/eden';
import Elysia, { t } from 'elysia';
import type { UserSchema } from '@/db/auth-schema';
import { userServices } from './service';

export interface UserContract {
  getUserIdByEmail: (email: string) => Promise<string | null>;
  updateUser: (
    userId: string,
    data: Partial<UserSchema>
  ) => Promise<UserSchema[]>;
}

export const userModule: UserContract = {
  async getUserIdByEmail(email: string) {
    return userServices.getUserIdByEmail(email);
  },
  async updateUser(userId: string, data: Partial<UserSchema>) {
    return userServices.updateUser(userId, data);
  },
};
