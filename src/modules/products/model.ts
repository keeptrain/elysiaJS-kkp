import { t } from 'elysia';

const PRODUCT_TYPES = {
  BENIH: 'benih',
  BIBIT: 'bibit',
} as const;

const PRODUCT_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const;

export const CreateProductBody = t.Object({
  name: t.String({ minLength: 3, maxLength: 150 }),
  type: t.Enum(PRODUCT_TYPES),
  status: t.Optional(t.Enum(PRODUCT_STATUSES)),
  stockAssitance: t.Optional(t.Number({ minimum: 0, default: 0 })),
  priceAssitance: t.Optional(t.Number({ minimum: 0, default: 0 })),
  stockCommercial: t.Optional(t.Number({ minimum: 0, default: 0 })),
  priceCommercial: t.Optional(t.Number({ minimum: 0, default: 0 })),
});

export type CreateProductBody = typeof CreateProductBody.static;

export const UpdateProductBody = t.Object(
  {
    name: t.Optional(t.String({ minLength: 3, maxLength: 150 })),
    type: t.Optional(t.Enum(PRODUCT_TYPES)),
    status: t.Optional(t.Enum(PRODUCT_STATUSES)),
    stockAssitance: t.Optional(t.Number({ minimum: 0 })),
    priceAssitance: t.Optional(t.Number({ minimum: 0 })),
    stockCommercial: t.Optional(t.Number({ minimum: 0 })),
    priceCommercial: t.Optional(t.Number({ minimum: 0 })),
  },
  { minProperties: 1 }
);

export type UpdateProductBody = typeof UpdateProductBody.static;

export const ListProductsQuery = t.Object({
  type: t.Optional(t.Enum(PRODUCT_TYPES)),
  organizationId: t.Optional(t.Numeric({ minimum: 1 })),
  cursor: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
  q: t.Optional(t.String({ maxLength: 150 })),
});

export type ListProductsQuery = typeof ListProductsQuery.static;
