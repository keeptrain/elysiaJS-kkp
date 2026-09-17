import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, openAPI, testUtils } from 'better-auth/plugins';
import { db } from '@/lib/pg-db';
import * as schema from '@/db/auth-schema';
import { resendMailer } from '@/lib/resend-mailer';
import { env } from '@/constants/env';
import {
  betterAuthEnabledPaths,
  betterAuthDisabledPaths,
} from '@/constants/routes';

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  rateLimit: {
    window: 60,
    max: 120,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    openAPI(),
    // Test-only: helper ctx.test (login, getAuthHeaders, capture OTP).
    // Tidak register HTTP route; sengaja tidak ikut ke config production.
    ...(env.isTest ? [testUtils({ captureOTP: true })] : []),
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 menit — samakan dengan flow /login lama
      // Bawaan 3 req/60s bikin re-run test flaky (429); longgarkan saat test.
      ...(env.isTest ? { rateLimit: { window: 60, max: 1000 } } : {}),
      async sendVerificationOTP({ email, otp }) {
        // NOTE: pembatasan @gmail.com ditegakkan di edge
        // (src/utils/auth-utils.ts, betterAuthView) karena hook ini jalan sebagai background task dan
        // throw di sini tidak menggagalkan response. Di sini tetap kirim apa
        // adanya agar flow server-side (auth.api.*) tidak hang.
        // Dev: tulis ke file html (lihat resend-mailer), prod: kirim via Resend.
        await resendMailer(email, Number(otp), 5);
      },
    }),
  ],
  cookies: {
    sessionToken: {
      name: 'session',
    },
  },
  session: {
    expiresIn: 86400,
    cookieCache: { enabled: true, maxAge: 300 },
  },
  trustedOrigins: env.CORS_ORIGIN_ALLOWED,
  enabledPaths: betterAuthEnabledPaths,
  disabledPaths: betterAuthDisabledPaths as unknown as string[],
});

export type Auth = typeof auth;
