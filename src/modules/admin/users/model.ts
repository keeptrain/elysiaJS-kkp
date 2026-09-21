import { t } from 'elysia';

export const CursorPaginationQuery = t.Object({
  cursor: t.Optional(t.String({ format: 'uuid' })),
  limit: t.Optional(t.Numeric({ default: 10 })),
  search: t.Optional(t.String()),
});

export type CursorPaginationQuery = typeof CursorPaginationQuery.static;

export const actionBody = t.Union([
  t.Object({ action: t.Literal('getById'), id: t.String() }),
  t.Object({
    action: t.Literal('create'),
    name: t.String(),
    email: t.String({ format: 'email' }),
  }),
  t.Object({
    action: t.Literal('update'),
    id: t.String(),
    name: t.Optional(t.String()),
    email: t.Optional(t.String({ format: 'email' })),
    metadata: t.Optional(t.Object({ kind: t.Optional(t.String()) })),
  }),
  t.Object({ action: t.Literal('delete'), id: t.String() }),
]);

export type UsersAction = typeof actionBody.static;
