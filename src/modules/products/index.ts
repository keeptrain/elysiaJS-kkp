import {
  authMiddleware,
  organizationMiddleware,
} from '@/middleware/auth-middleware';
import { randomUUIDv7 } from 'bun';
import Elysia from 'elysia';

export const productsApp = new Elysia().get('/products', () => {
  const products = [
    {
      id: randomUUIDv7(),
      name: 'Product 1',
      price: 10.99,
      description: 'This is product 1',
    },
    {
      id: randomUUIDv7(),
      name: 'Product 2',
      price: 19.99,
      description: 'This is product 2',
    },
  ];
  return { data: products };
});
