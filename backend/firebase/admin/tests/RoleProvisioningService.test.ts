import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoleProvisioningService } from "../src/services/RoleProvisioningService.js";
import type { FirebaseAdminGateway } from "../src/gateways/FirebaseAdminGateway.js";

describe("RoleProvisioningService", () => {
  let mockGateway: FirebaseAdminGateway;
  let service: RoleProvisioningService;

  beforeEach(() => {
    mockGateway = {
      getUser: vi.fn().mockResolvedValue({
        uid: "test-user-123",
        customClaims: { existingClaim: "preserved-val" },
      }),
      setCustomUserClaims: vi.fn(),
      revokeRefreshTokens: vi.fn(),
    };
    service = new RoleProvisioningService(mockGateway);
  });

  it("throws when UID is empty or invalid", async () => {
    await expect(service.getCustomClaims("")).rejects.toThrow("Invalid UID");
    await expect(service.setRole("   ", "support")).rejects.toThrow("Invalid UID");
  });

  it("throws when UID is longer than 128 characters", async () => {
    const longUid = "a".repeat(129);
    await expect(service.getCustomClaims(longUid)).rejects.toThrow("Firebase UIDs must be 128 characters or fewer");
  });

  it("sets supported roles and preserves unrelated claims", async () => {
    const { claims, changed } = await service.setRole("test-user-123", "moderator");

    expect(mockGateway.setCustomUserClaims).toHaveBeenCalledWith("test-user-123", {
      existingClaim: "preserved-val",
      role: "moderator",
    });
    expect(mockGateway.revokeRefreshTokens).toHaveBeenCalledWith("test-user-123");
    expect(changed).toBe(true);
    expect(claims).toEqual({
      existingClaim: "preserved-val",
      role: "moderator",
    });
  });

  it("avoids rewriting claims and revoking tokens if the role has not changed", async () => {
    mockGateway.getUser = vi.fn().mockResolvedValue({
      uid: "test-user-123",
      customClaims: { existingClaim: "preserved-val", role: "moderator" },
    });

    const { claims, changed } = await service.setRole("test-user-123", "moderator");

    expect(mockGateway.setCustomUserClaims).not.toHaveBeenCalled();
    expect(mockGateway.revokeRefreshTokens).not.toHaveBeenCalled();
    expect(changed).toBe(false);
    expect(claims.role).toBe("moderator");
  });

  it("throws on unsupported roles", async () => {
    await expect(service.setRole("test-user-123", "hacker")).rejects.toThrow("Invalid role");
    expect(mockGateway.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("removes only the role claim, preserving other claims", async () => {
    mockGateway.getUser = vi.fn().mockResolvedValue({
      uid: "test-user-123",
      customClaims: { existingClaim: "preserved-val", role: "moderator" },
    });

    const { claims, changed } = await service.removeRole("test-user-123");

    expect(mockGateway.setCustomUserClaims).toHaveBeenCalledWith("test-user-123", {
      existingClaim: "preserved-val",
    });
    expect(changed).toBe(true);
    expect(claims).toEqual({
      existingClaim: "preserved-val",
    });
  });

  it("bootstraps super admin only if the confirm safety flag is set", async () => {
    // 1. Fails without confirm safety flag
    await expect(service.bootstrapSuperAdmin("test-user-123", false)).rejects.toThrow(
      "Accidental execution safeguard"
    );

    // 2. Succeeds with confirm safety flag
    const { claims, changed } = await service.bootstrapSuperAdmin("test-user-123", true);
    expect(mockGateway.setCustomUserClaims).toHaveBeenCalledWith("test-user-123", {
      existingClaim: "preserved-val",
      role: "super_admin",
    });
    expect(changed).toBe(true);
    expect(claims.role).toBe("super_admin");
  });

  it("rejects bootstrapping super admin if already assigned", async () => {
    mockGateway.getUser = vi.fn().mockResolvedValue({
      uid: "test-user-123",
      customClaims: { role: "super_admin" },
    });

    await expect(service.bootstrapSuperAdmin("test-user-123", true)).rejects.toThrow(
      "Super admin role already bootstrapped"
    );
    expect(mockGateway.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
