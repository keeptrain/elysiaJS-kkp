export const ROLES = {
  ADMIN: 'admin', // Admin Pusat
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Organizations
 */
export const ORGANIZATION_POSITIONS = {
  HEAD: 'head',
  STAFF: 'staff',
} as const;

export type OrganizationPosition =
  (typeof ORGANIZATION_POSITIONS)[keyof typeof ORGANIZATION_POSITIONS];

export const MARKETPLACE_ROLES = {
  ADMIN: 'shop_admin',
  OPERATOR: 'shop_operator',
};

export type MarketPlaceRole =
  (typeof MARKETPLACE_ROLES)[keyof typeof MARKETPLACE_ROLES];

export const MAGANG_ROLES = {
  ADMIN: 'magang_admin',
  OPERATOR: 'magang_operator',
};

export type MagangRole = (typeof MAGANG_ROLES)[keyof typeof MAGANG_ROLES];

type MagangRolesType = (typeof MAGANG_ROLES)[keyof typeof MAGANG_ROLES];

export const TESTS: Record<OrganizationPosition, MagangRolesType> = {
  head: '',
  staff: 'shop_operator',
};

export type AppRole = Role | MarketPlaceRole | MagangRole;
