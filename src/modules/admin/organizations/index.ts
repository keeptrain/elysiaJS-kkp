import { Elysia, status, t } from 'elysia';
import { organizationService } from './service';
import type { AppRole, OrganizationPosition } from '@/constants/access-control';
import { authMiddleware } from '@/middleware/auth-middleware';

const actionBody = t.Union([
  t.Object({
    action: t.Literal('list'),
    filters: t.Optional(t.Object({ search: t.Optional(t.String()) })),
  }),
  t.Object({ action: t.Literal('get'), id: t.String() }),
  t.Object({
    action: t.Literal('create'),
    name: t.String(),
    code: t.String(),
  }),
  t.Object({
    action: t.Literal('update'),
    id: t.String(),
    name: t.Optional(t.String()),
    code: t.Optional(t.String()),
  }),
  t.Object({ action: t.Literal('delete'), id: t.String() }),
  t.Object({
    action: t.Literal('listMembers'),
    organizationId: t.String(),
  }),
  t.Object({
    action: t.Literal('addMember'),
    userId: t.String(),
    organizationId: t.String(),
    position: t.Optional(t.String()),
    roles: t.Array(t.String(), { minItems: 1 }),
  }),
  t.Object({
    action: t.Literal('updateMemberRole'),
    userId: t.String(),
    organizationId: t.String(),
    roles: t.Array(t.String(), { minItems: 1 }),
  }),
  t.Object({
    action: t.Literal('removeMember'),
    userId: t.String(),
    organizationId: t.String(),
  }),
]);

export type OrganizationsAction = typeof actionBody.static;

export const organizationsApp = new Elysia({
  prefix: '/organizations',
  detail: { tags: ['organizations'], hide: true },
})
  .use(authMiddleware)
  .post(
    '',
    async ({ body }) => {
      switch (body.action) {
        case 'list':
          return organizationService.list(body.filters);

        case 'get': {
          const org = await organizationService.getById(body.id);
          if (!org) return status(404, { message: 'Organization not found' });
          return org;
        }

        case 'create':
          return organizationService.create({
            name: body.name,
            code: body.code,
          });

        case 'update': {
          const updated = await organizationService.update(body.id, {
            name: body.name,
            code: body.code,
          });
          if (!updated)
            return status(404, { message: 'Organization not found' });
          return updated;
        }

        case 'delete':
          return organizationService.delete(body.id);

        case 'listMembers':
          return organizationService.listMembers(body.organizationId);

        case 'addMember':
          return organizationService.addMember({
            userId: body.userId,
            organizationId: body.organizationId,
            position: body.position as OrganizationPosition | undefined,
            roles: body.roles as AppRole[],
          });

        case 'updateMemberRole':
          return organizationService.updateMemberRole(
            body.userId,
            body.organizationId,
            body.roles as AppRole[]
          );

        case 'removeMember':
          return organizationService.removeMember(
            body.userId,
            body.organizationId
          );
      }
    },
    { body: actionBody }
  );
