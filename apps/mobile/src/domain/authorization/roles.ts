export type AuthorizationRole =
  | "user"
  | "support"
  | "moderator"
  | "operations_admin"
  | "safety_admin"
  | "super_admin";

const VALID_ROLES: ReadonlySet<AuthorizationRole> = new Set<AuthorizationRole>([
  "user",
  "support",
  "moderator",
  "operations_admin",
  "safety_admin",
  "super_admin",
]);

export function normalizeAuthorizationRole(value: unknown): AuthorizationRole {
  if (typeof value !== "string") {
    return "user";
  }
  const role = value as AuthorizationRole;
  if (VALID_ROLES.has(role)) {
    return role;
  }
  return "user";
}
