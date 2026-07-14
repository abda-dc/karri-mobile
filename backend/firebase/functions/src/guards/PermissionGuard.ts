import { HttpsError } from "firebase-functions/v2/https";

export type Permission =
  | "view_operations"
  | "view_safety_declarations"
  | "moderate_listings"
  | "manage_safety_reviews"
  | "manage_mediation_cases"
  | "place_administrative_holds"
  | "restrict_accounts"
  | "assign_roles"
  | "view_audit_logs";

export type AuthorizationRole =
  | "user"
  | "support"
  | "moderator"
  | "operations_admin"
  | "safety_admin"
  | "super_admin";

const ROLE_PERMISSIONS: Record<AuthorizationRole, ReadonlySet<Permission>> = {
  user: new Set(),
  support: new Set(),
  moderator: new Set(["view_safety_declarations", "moderate_listings"]),
  operations_admin: new Set([
    "view_operations",
    "manage_mediation_cases",
    "place_administrative_holds",
  ]),
  safety_admin: new Set([
    "view_safety_declarations",
    "moderate_listings",
    "manage_safety_reviews",
    "place_administrative_holds",
    "restrict_accounts",
  ]),
  super_admin: new Set([
    "view_operations",
    "view_safety_declarations",
    "moderate_listings",
    "manage_safety_reviews",
    "manage_mediation_cases",
    "place_administrative_holds",
    "restrict_accounts",
    "assign_roles",
    "view_audit_logs",
  ]),
};

export function assertPermission(auth: any, permission: Permission): { uid: string; role: AuthorizationRole } {
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "Unauthenticated request.");
  }

  const roleClaim = auth.token?.role;
  const role: AuthorizationRole =
    typeof roleClaim === "string" && roleClaim in ROLE_PERMISSIONS
      ? (roleClaim as AuthorizationRole)
      : "user";

  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions.has(permission)) {
    throw new HttpsError(
      "permission-denied",
      `Permission denied: actor with role '${role}' does not have the '${permission}' permission.`
    );
  }

  return { uid: auth.uid, role };
}
