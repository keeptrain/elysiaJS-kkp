export type Route = 'ROOT' | 'LOGIN';

export const ROUTES: Record<Route, string> = {
  ROOT: '/',
  LOGIN: '/login',
};

export const betterAuthEnabledPaths = [
  '/email-otp/send-verification-otp',
  '/sign-in/email-otp',
  '/sign-in/social',
  '/callback/*',
  '/get-session',
  '/sign-out',
] as const;

export const betterAuthDisabledPaths = [
  '/sign-up/email',
  '/reset-password',
  '/forgot-password',
  '/send-verification-email',
  '/verify-email',
  '/delete-user',
  '/update-user',
  '/change-password',
  '/link-social',
  '/list-sessions',
  '/revoke-session',
  '/revoke-sessions',
] as const;
