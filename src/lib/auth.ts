import { betterAuth } from 'better-auth/minimal';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  emailOTP,
  openAPI,
  testUtils,
} from 'better-auth/plugins';
import { randomUUIDv7 } from 'bun';
import { db } from '@/lib/pg-db';
import { findMemberByUserId } from '@/modules/organizations/membership';
import * as schema from '@/db/auth-schema';
import { resendMailer } from '@/lib/resend-mailer';
import { env } from '@/constants/env';
import {
  betterAuthEnabledPaths,
  betterAuthDisabledPaths,
} from '@/constants/routes';

const strippedSessionFields = {
  createdAt: {
    type: 'date',
    required: true,
    returned: false,
    defaultValue: () => new Date(),
  },
  updatedAt: {
    type: 'date',
    required: true,
    returned: false,
    onUpdate: () => new Date(),
  },
  ipAddress: { type: 'string', required: false, returned: false },
  userAgent: { type: 'string', required: false, returned: false },
} as const;

const strippedUserFields = {
  emailVerified: { type: 'boolean', required: false, returned: false },
  image: { type: 'string', required: false, returned: false },
  metadata: { type: 'json', required: false },
  createdAt: {
    type: 'date',
    required: true,
    returned: false,
    defaultValue: () => new Date(),
  },
  updatedAt: {
    type: 'date',
    required: true,
    returned: false,
    defaultValue: () => new Date(),
    onUpdate: () => new Date(),
  },
} as const;

// Organization hanya di RESPONSE get-session, tidak masuk cookie cache.
// Cookie tetap ramping (session+user); org selalu fresh dari DB tiap panggil.
const enrichGetSessionOrganization = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== '/get-session') return;
  const returned = ctx.context.returned as {
    user: { id: string; metadata?: { kind?: string } | null };
  } | null;
  if (!returned) return;
  // skip join , when user.metadata is not organization
  if (returned.user.metadata?.kind === 'admin') {
    ctx.context.returned = { ...returned, organization: null };
    return;
  }
  // Lookup via service (cache-aside)
  const member = await findMemberByUserId(returned.user.id);
  ctx.context.returned = {
    ...returned,
    organization: member
      ? {
          id: member.organizationId,
          position: member.position,
          roles: member.roles,
        }
      : null,
  };
});

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  session: {
    expiresIn: 604800, // 7 days
    cookieCache: { enabled: true, maxAge: 300, version: '1' }, // 5 minutes
    additionalFields: {
      ...strippedSessionFields,
    },
  },
  user: {
    additionalFields: {
      ...strippedUserFields,
    },
  },
  rateLimit: {
    window: 60,
    max: 120,
  },
  advanced: {
    cookiePrefix: 'app',
    database: {
      generateId: () => randomUUIDv7(),
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
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  trustedOrigins: env.CORS_ORIGIN_ALLOWED,
  enabledPaths: betterAuthEnabledPaths,
  disabledPaths: betterAuthDisabledPaths as unknown as string[],
  hooks: {
    after: enrichGetSessionOrganization,
  },
});

export type Auth = typeof auth;
