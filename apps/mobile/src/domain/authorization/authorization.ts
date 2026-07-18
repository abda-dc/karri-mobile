import type { AuthorizationRole } from "./roles";
import { normalizeAuthorizationRole } from "./roles";
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

export type AdminRouteDecision =
  | "loading"
  | "sign-in-required"
  | "anonymous-denied"
  | "access-denied"
  | "authorization-error"
  | "allowed";

export const ADMINISTRATIVE_PERMISSIONS: readonly Permission[] = Object.freeze([
  "view_operations",
  "view_safety_declarations",
  "moderate_listings",
  "manage_safety_reviews",
  "manage_mediation_cases",
  "place_administrative_holds",
  "restrict_accounts",
  "assign_roles",
  "view_audit_logs",
]);

export function evaluateAdminRouteDecision(options: {
  readonly loading: boolean;
  readonly user: { readonly isAnonymous: boolean } | null;
  readonly role: unknown;
  readonly verified: boolean;
  readonly error: string | null;
}): AdminRouteDecision {
  if (options.loading) {
    return "loading";
  }

  if (options.error) {
    return "authorization-error";
  }

  if (!options.user) {
    return "sign-in-required";
  }

  if (options.user.isAnonymous) {
    return "anonymous-denied";
  }

  if (!options.verified) {
    return "loading";
  }

  const normalizedRole = normalizeAuthorizationRole(options.role);
  const hasAdminPermission = ADMINISTRATIVE_PERMISSIONS.some((permission) =>
    hasPermission(normalizedRole, permission)
  );

  return hasAdminPermission ? "allowed" : "access-denied";
}
