# modules/auth

## Kenapa tidak ada controller

Modul ini tidak punya controller. Semua HTTP auth (`/api/auth/*`)
ditangani langsung oleh Better Auth yang dikonfigurasi di `src/lib/auth.ts`
dan dipasang sebagai catch-all di `src/index.ts`. Modul ini hanya berisi
aturan tepi (edge rules) dan test.

## Metode login yang aktif

- Email OTP (6 digit, 5 menit)
  - endpoint
    - `POST /email-otp/send-verification-otp`
    - `POST /sign-in/email-otp`
  - flow
    - client kirim email lalu server kirim OTP ke email tersebut
    - prod kirim via Resend, non-prod tulis file html
    - client kirim balik email + OTP lalu server verifikasi
  - response
    - sukses 200 berisi JSON user + session dan cookie `session` ter-set
    - user baru otomatis dibuat saat OTP benar pertama kali
    - gagal 400 bila bukan `@gmail.com` atau OTP salah atau kadaluarsa
- Google OAuth
  - endpoint
    - `POST /sign-in/social`
    - `GET /callback/{id}`
  - flow
    - client kirim provider google + callbackURL
    - server return URL Google lalu user login di Google
    - Google redirect ke callback lalu server buat session
  - response
    - `POST /sign-in/social` sukses 200 berisi url dan redirect flag
    - callback sukses berupa redirect dan cookie `session` ter-set
    - gagal 302 ke error URL bila state tidak cocok
- Session
  - endpoint
    - `GET /get-session`
    - `POST /sign-out`
  - flow
    - `GET /get-session` baca cookie lalu return session aktif atau null
    - `POST /sign-out` hapus session di DB
  - response
    - `GET` sukses 200 berisi user + session atau null bila belum login
    - `POST /sign-out` sukses 200 dan session terhapus

Hanya 6 path di atas yang aktif (`enabledPaths` di `src/lib/auth.ts`,
daftar di `src/constants/routes.ts`). Endpoint lain (sign-up email,
reset password, dsb) return 404 (`disabledPaths`).

## Cookie spec

- app
  - app.session.data
    Key: WRcIqH0W8FrtmHVXKEvRQDwXKKjBAfcT (cookie: "app.session_token")

  ```json
  {
    "session": {
      "id": "rvoKVrwmvbWYSW5WnWnxjxtMfdf7EJeW",
      // "ipAddress": "",
      // "userAgent": "",
      "expiresAt": "2026-09-18T23:28:27.114Z",
      // "userId": "0B3JuTZL93txDGeBKZ2vnw8KvcCLZEnA",
      "token": "WRcIqH0W8FrtmHVXKEvRQDwXKKjBAfcT"
      // "createdAt": "2026-09-17T23:28:27.114Z",
      // "updatedAt": "2026-09-17T23:28:27.114Z"
    },
    "user": {
      "name": "Test User",
      "email": "guard@gmail.com",
      // "emailVerified": true,
      // "image": null,
      // "createdAt": "2026-09-17T23:28:27.112Z",
      // "updatedAt": "2026-09-17T23:28:27.112Z",
      "id": "0B3JuTZL93txDGeBKZ2vnw8KvcCLZEnA"
    }
  }
  ```

- app.session

  ```json
  [
    {
      "token": "WRcIqH0W8FrtmHVXKEvRQDwXKKjBAfcT",
      "expiresAt": 1789774107114
    }
  ]
  ```

## Aturan

- Hanya email `@gmail.com` (`betterAuthView` di `utils.ts`).
- Session cookie bernama `session`, umur 1 hari + cache 5 menit.
- Docs OpenAPI hanya tampilkan path relevan (`RELEVANT_AUTH_PATHS`).

```

```
