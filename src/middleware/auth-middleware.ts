import { Elysia, status } from 'elysia';

export const authMiddleware = new Elysia().onBeforeHandle(({ headers }) => {
  const authHeader = headers['authorization'];

  // Jika tidak ada header atau format salah
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return status(401, { message: 'Unauthorized: Token tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];

  // Contoh validasi token sederhana
  if (token !== 'token-rahasia-saya') {
    return status(401, { message: 'Unauthorized: Token tidak valid' });
  }

  // Jika lolos, biarkan request lanjut ke handler berikutnya
});
