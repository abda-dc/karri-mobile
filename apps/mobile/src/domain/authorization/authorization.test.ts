import { describe, it, expect } from "vitest";
import {
  normalizeAuthorizationRole,
  hasPermission,
  getPermissionsForRole,
  canViewOperations,
  canViewSafetyDeclarations,
  canModerateListings,
  canManageSafetyReviews,
  canManageMediationCases,
  canPlaceAdministrativeHolds,
  canRestrictAccounts,
  canAssignRoles,
  canViewAuditLogs,
  type AuthorizationRole,
  type Permission
} from "./authorization";

describe("Authorization Rules and Role-Permission Mapping", () => {
  it("normalizes every valid role correctly", () => {
    expect(normalizeAuthorizationRole("user")).toBe("user");
    expect(normalizeAuthorizationRole("support")).toBe("support");
    expect(normalizeAuthorizationRole("moderator")).toBe("moderator");
    expect(normalizeAuthorizationRole("operations_admin")).toBe("operations_admin");
    expect(normalizeAuthorizationRole("safety_admin")).toBe("safety_admin");
    expect(normalizeAuthorizationRole("super_admin")).toBe("super_admin");
  });

  it("normalizes missing, malformed, and unsupported roles to user", () => {
    expect(normalizeAuthorizationRole(undefined)).toBe("user");
    expect(normalizeAuthorizationRole(null)).toBe("user");
    expect(normalizeAuthorizationRole(123)).toBe("user");
    expect(normalizeAuthorizationRole({})).toBe("user");
    expect(normalizeAuthorizationRole("hacker")).toBe("user");
    expect(normalizeAuthorizationRole("ADMIN")).toBe("user");
  });

  it("user has no administrative permissions", () => {
    const allPermissions: Permission[] = [
      "view_operations",
      "view_safety_declarations",
      "moderate_listings",
      "manage_safety_reviews",
      "manage_mediation_cases",
      "place_administrative_holds",
      "restrict_accounts",
      "assign_roles",
      "view_audit_logs"
    ];
    allPermissions.forEach(permission => {
      expect(hasPermission("user", permission)).toBe(false);
    });
  });

  it("support has no administrative permissions in this initial mapping", () => {
    const allPermissions: Permission[] = [
      "view_operations",
      "view_safety_declarations",
      "moderate_listings",
      "manage_safety_reviews",
      "manage_mediation_cases",
      "place_administrative_holds",
      "restrict_accounts",
      "assign_roles",
      "view_audit_logs"
    ];
    allPermissions.forEach(permission => {
      expect(hasPermission("support", permission)).toBe(false);
    });
  });

  it("each specialist role receives exactly its listed permissions", () => {
    // Moderator permissions
    expect(hasPermission("moderator", "view_safety_declarations")).toBe(true);
    expect(hasPermission("moderator", "moderate_listings")).toBe(true);
    expect(hasPermission("moderator", "view_operations")).toBe(false);

    // Operations admin permissions
    expect(hasPermission("operations_admin", "view_operations")).toBe(true);
    expect(hasPermission("operations_admin", "manage_mediation_cases")).toBe(true);
    expect(hasPermission("operations_admin", "place_administrative_holds")).toBe(true);
    expect(hasPermission("operations_admin", "assign_roles")).toBe(false);

    // Safety admin permissions
    expect(hasPermission("safety_admin", "view_safety_declarations")).toBe(true);
    expect(hasPermission("safety_admin", "moderate_listings")).toBe(true);
    expect(hasPermission("safety_admin", "manage_safety_reviews")).toBe(true);
    expect(hasPermission("safety_admin", "place_administrative_holds")).toBe(true);
    expect(hasPermission("safety_admin", "restrict_accounts")).toBe(true);
    expect(hasPermission("safety_admin", "assign_roles")).toBe(false);
  });

  it("super_admin receives every currently defined permission", () => {
    const allPermissions: Permission[] = [
      "view_operations",
      "view_safety_declarations",
      "moderate_listings",
      "manage_safety_reviews",
      "manage_mediation_cases",
      "place_administrative_holds",
      "restrict_accounts",
      "assign_roles",
      "view_audit_logs"
    ];
    allPermissions.forEach(permission => {
      expect(hasPermission("super_admin", permission)).toBe(true);
    });
  });

  it("no non-super-admin receives assign_roles", () => {
    const roles: AuthorizationRole[] = [
      "user",
      "support",
      "moderator",
      "operations_admin",
      "safety_admin"
    ];
    roles.forEach(role => {
      expect(hasPermission(role, "assign_roles")).toBe(false);
    });
  });

  it("permission-specific helpers match hasPermission", () => {
    const roles: AuthorizationRole[] = [
      "user",
      "support",
      "moderator",
      "operations_admin",
      "safety_admin",
      "super_admin"
    ];
    roles.forEach(role => {
      expect(canViewOperations(role)).toBe(hasPermission(role, "view_operations"));
      expect(canViewSafetyDeclarations(role)).toBe(hasPermission(role, "view_safety_declarations"));
      expect(canModerateListings(role)).toBe(hasPermission(role, "moderate_listings"));
      expect(canManageSafetyReviews(role)).toBe(hasPermission(role, "manage_safety_reviews"));
      expect(canManageMediationCases(role)).toBe(hasPermission(role, "manage_mediation_cases"));
      expect(canPlaceAdministrativeHolds(role)).toBe(hasPermission(role, "place_administrative_holds"));
      expect(canRestrictAccounts(role)).toBe(hasPermission(role, "restrict_accounts"));
      expect(canAssignRoles(role)).toBe(hasPermission(role, "assign_roles"));
      expect(canViewAuditLogs(role)).toBe(hasPermission(role, "view_audit_logs"));
    });
  });

  it("returned permission data cannot be mutated to affect the central mapping", () => {
    const role: AuthorizationRole = "moderator";
    const originalPermissions = getPermissionsForRole(role);
    expect(originalPermissions).toContain("moderate_listings");

    // Mutate the returned array via type cast
    const mutablePermissions = originalPermissions as Permission[];
    mutablePermissions.push("assign_roles");

    // Verify a fresh call still returns original mapping without modifications
    const freshPermissions = getPermissionsForRole(role);
    expect(freshPermissions).not.toContain("assign_roles");
    expect(freshPermissions).toEqual(["view_safety_declarations", "moderate_listings"]);

    // Verify hasPermission check remains unaffected
    expect(hasPermission(role, "assign_roles")).toBe(false);
  });
});
