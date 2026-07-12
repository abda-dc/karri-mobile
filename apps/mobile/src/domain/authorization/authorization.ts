import type { AuthorizationRole } from "./roles";
import type { Permission } from "./permissions";
import { hasPermission } from "./rolePermissions";

export { AuthorizationRole, normalizeAuthorizationRole } from "./roles";
export { Permission } from "./permissions";
export { hasPermission, getPermissionsForRole } from "./rolePermissions";

export function canViewOperations(role: AuthorizationRole): boolean {
  return hasPermission(role, "view_operations");
}

export function canViewSafetyDeclarations(role: AuthorizationRole): boolean {
  return hasPermission(role, "view_safety_declarations");
}

export function canModerateListings(role: AuthorizationRole): boolean {
  return hasPermission(role, "moderate_listings");
}

export function canManageSafetyReviews(role: AuthorizationRole): boolean {
  return hasPermission(role, "manage_safety_reviews");
}

export function canManageMediationCases(role: AuthorizationRole): boolean {
  return hasPermission(role, "manage_mediation_cases");
}

export function canPlaceAdministrativeHolds(role: AuthorizationRole): boolean {
  return hasPermission(role, "place_administrative_holds");
}

export function canRestrictAccounts(role: AuthorizationRole): boolean {
  return hasPermission(role, "restrict_accounts");
}

export function canAssignRoles(role: AuthorizationRole): boolean {
  return hasPermission(role, "assign_roles");
}

export function canViewAuditLogs(role: AuthorizationRole): boolean {
  return hasPermission(role, "view_audit_logs");
}
