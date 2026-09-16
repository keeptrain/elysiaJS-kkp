// Legacy shim — skema kini didefinisikan oleh Better Auth CLI di
// `./auth-schema.ts` (tabel: users, sessions, accounts, verifications).
// File ini dipertahankan agar import lama tidak langsung rusak selama migrasi,
// tapi modul auth custom (/login, otps, session-store) sudah dihapus.
export * from './auth-schema';
