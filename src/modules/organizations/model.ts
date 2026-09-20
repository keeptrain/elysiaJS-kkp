import { t } from 'elysia';

export const CursorPaginationQuery = t.Object({
  cursor: t.Optional(t.String({ format: 'uuid' })), // cursor is the last seen id, used for pagination
  limit: t.Optional(t.Numeric({ default: 10 })),
});

export type CursorPaginationQuery = typeof CursorPaginationQuery.static;
