import { generateRandomString } from '../utils/utils';

export interface StoredSession {
  token: string;
  userId: string;
  /** ISO string */
  expiresAt: string;
}

const DEFAULT_TTL_SECONDS = 24 * 60 * 60; // 1 hari

/** Abstraksi penyimpanan session — ganti implementasi ke Upstash/Redis tanpa ubah pemanggil. */
export interface SessionStore {
  create(
    userId: string,
    ttlSeconds?: number
  ): Promise<{ token: string; maxAge: number }>;
  get(token: string): Promise<StoredSession | null>;
  delete(token: string): Promise<void>;
  /** Helper isolasi test/maintenance. */
  clear(): Promise<void>;
}

export class InMemorySessionStore implements SessionStore {
  private sessions = new Map<string, StoredSession>();

  async create(userId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
    const token = generateRandomString(32);
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.sessions.set(token, {
      token,
      userId,
      expiresAt: new Date(expiresAt).toISOString(),
    });
    return {
      token,
      maxAge: Math.floor((expiresAt - Date.now()) / 1000),
    };
  }

  async get(token: string) {
    return this.sessions.get(token) ?? null;
  }

  async delete(token: string) {
    this.sessions.delete(token);
  }

  async clear() {
    this.sessions.clear();
  }
}

export const sessionStore: SessionStore = new InMemorySessionStore();
