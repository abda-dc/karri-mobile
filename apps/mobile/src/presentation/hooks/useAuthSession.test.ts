import { describe, it, expect, vi, beforeEach } from "vitest";
import { evaluateAdminRouteDecision } from "../../domain/authorization/authorization";
import { mobileServices } from "../services/mobileServices";

vi.mock("../services/mobileServices", () => ({
  mobileServices: {
    auth: {
      isConfigured: true,
      subscribe: vi.fn(),
      refreshAuthorization: vi.fn(),
    },
  },
}));

describe("evaluateAdminRouteDecision Matrix", () => {
  const verifiedUserIdentity = { uid: "user-123", email: "user-123@karri.com", isAnonymous: false, createdAt: "2026-07-12T12:00:00Z" };
  const anonymousUserIdentity = { uid: "user-anonymous", email: null, isAnonymous: true, createdAt: "2026-07-12T12:00:00Z" };

  it("returns 'loading' when loading is true, regardless of user/role status", () => {
    const result = evaluateAdminRouteDecision({
      loading: true,
      user: verifiedUserIdentity,
      role: "super_admin",
      verified: true,
      error: null,
    });
    expect(result).toBe("loading");
  });

  it("returns 'authorization-error' when error is present", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: "super_admin",
      verified: true,
      error: "Refresh failed",
    });
    expect(result).toBe("authorization-error");
  });

  it("returns 'sign-in-required' when user is signed out (null)", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: null,
      role: "super_admin",
      verified: true,
      error: null,
    });
    expect(result).toBe("sign-in-required");
  });

  it("returns 'anonymous-denied' when user is anonymous", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: anonymousUserIdentity,
      role: "super_admin",
      verified: true,
      error: null,
    });
    expect(result).toBe("anonymous-denied");
  });

  it("returns 'loading' when verified is false (claims verification in progress)", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: "super_admin",
      verified: false,
      error: null,
    });
    expect(result).toBe("loading");
  });

  it("returns 'access-denied' for ordinary users ('user' role)", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: "user",
      verified: true,
      error: null,
    });
    expect(result).toBe("access-denied");
  });

  it("returns 'access-denied' for support users ('support' role)", () => {
    const result = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: "support",
      verified: true,
      error: null,
    });
    expect(result).toBe("access-denied");
  });

  it("returns 'access-denied' for missing, malformed, or unsupported roles", () => {
    const missingRoleResult = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: undefined,
      verified: true,
      error: null,
    });
    const malformedRoleResult = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: { some: "object" },
      verified: true,
      error: null,
    });
    const unsupportedRoleResult = evaluateAdminRouteDecision({
      loading: false,
      user: verifiedUserIdentity,
      role: "unsupported_role_name",
      verified: true,
      error: null,
    });

    expect(missingRoleResult).toBe("access-denied");
    expect(malformedRoleResult).toBe("access-denied");
    expect(unsupportedRoleResult).toBe("access-denied");
  });

  it("returns 'allowed' for verified administrator roles", () => {
    const roles = ["moderator", "operations_admin", "safety_admin", "super_admin"];
    for (const role of roles) {
      const result = evaluateAdminRouteDecision({
        loading: false,
        user: verifiedUserIdentity,
        role,
        verified: true,
        error: null,
      });
      expect(result).toBe("allowed");
    }
  });
});
