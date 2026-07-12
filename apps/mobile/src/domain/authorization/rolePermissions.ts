import type { AuthorizationRole } from "./roles";
import type { Permission } from "./permissions";

// Centralized role-to-permission mapping (deeply frozen)
const ROLE_PERMISSIONS: Record<AuthorizationRole, readonly Permission[]> = {
  user: Object.freeze([] as Permission[]),
  support: Object.freeze([] as Permission[]),
  moderator: Object.freeze([
    "view_safety_declarations",
    "moderate_listings",
  ] as Permission[]),
  operations_admin: Object.freeze([
    "view_operations",
    "manage_mediation_cases",
    "place_administrative_holds",
  ] as Permission[]),
  safety_admin: Object.freeze([
    "view_safety_declarations",
    "moderate_listings",
    "manage_safety_reviews",
    "place_administrative_holds",
    "restrict_accounts",
  ] as Permission[]),
  super_admin: Object.freeze([
    "view_operations",
    "view_safety_declarations",
    "moderate_listings",
    "manage_safety_reviews",
    "manage_mediation_cases",
    "place_administrative_holds",
    "restrict_accounts",
    "assign_roles",
    "view_audit_logs",
  ] as Permission[]),
};

export function hasPermission(
  role: AuthorizationRole,
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getPermissionsForRole(
  role: AuthorizationRole
): readonly Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
