import { auth } from '../lib/auth';

export const GMAIL_ONLY = '@gmail.com';

// Hanya endpoint yang benar-benar dipakai app — sisanya di-hide dari /openapi
// agar dokumentasi tidak penuh dengan route Better Auth yang tidak relevan
// (reset-password, delete-user, dsb). Lihat generateOpenAPISchema untuk daftar lengkap.
export const RELEVANT_AUTH_PATHS = new Set([
  '/email-otp/send-verification-otp', // POST — kirim OTP (Gmail-only via betterAuthView)
  '/sign-in/email-otp', // POST — verifikasi OTP + buat session
  '/sign-in/social', // POST — trigger Google OAuth
  '/callback/{id}', // GET — OAuth callback Google
  '/get-session', // GET — cek session (dipakai authMiddleware)
  '/sign-out', // POST — logout
]);

export const betterAuthView = async ({ request }: { request: Request }) => {
  // Tegakkan Gmail-only SEBELUM masuk Better Auth — sendVerificationOTP jalan
  // sebagai background task sehingga throw di sana tidak menggagalkan response.
  const url = new URL(request.url);
  if (
    request.method === 'POST' &&
    url.pathname.endsWith('/email-otp/send-verification-otp')
  ) {
    try {
      const body = (await request.clone().json()) as unknown;
      const email =
        typeof body === 'object' && body !== null
          ? (body as { email?: unknown }).email
          : undefined;
      if (typeof email === 'string' && !email.endsWith(GMAIL_ONLY)) {
        return Response.json(
          { message: 'Invalid email format' },
          { status: 400 }
        );
      }
    } catch {
      // body bukan JSON valid — serahkan ke auth.handler untuk validasi asli
    }
  }
  return auth.handler(request);
};

export const betterAuthRouteHook = {
  detail: {
    tags: ['auth'],
    summary: 'Better Auth (catch-all)',
    description:
      'Semua endpoint auth (sign-in email-OTP, Google OAuth, session) ditangani Better Auth. ' +
      'Dokumentasi lengkap per-endpoint ada di UI Scalar `/api/auth/reference` ' +
      'atau skema JSON `/api/auth/open-api/generate-schema`.',
    hide: true,
  },
};
