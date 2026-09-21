import { t } from 'elysia';
import { ORGANIZATION_POSITIONS } from '@/constants/access-control';

export const CursorPaginationQuery = t.Object({
  cursor: t.Optional(t.String({ format: 'uuid' })), // cursor is the last seen id, used for pagination
  limit: t.Optional(t.Numeric({ default: 10 })),
});

export type CursorPaginationQuery = typeof CursorPaginationQuery.static;

export const AddMemberBody = t.Object({
  email: t.String({ minLength: 6, maxLength: 123, format: 'email' }),
  position: t.Enum(ORGANIZATION_POSITIONS),
  roles: t.Optional(t.Array(t.String({ minLength: 3, maxLength: 50 }))),
});

export type AddMemberBody = typeof AddMemberBody.static;