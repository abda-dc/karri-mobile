import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAdminConsoleGateway } from "../src/gateways/FirebaseAdminGateway.js";
import { AdminConsoleClaimsService } from "../src/services/AdminConsoleClaimsService.js";

describe("AdminConsoleClaimsService", () => {
  let gateway: FirebaseAdminConsoleGateway;
  let service: AdminConsoleClaimsService;

  beforeEach(() => {
    const user = {
      uid: "existing-user-123456",
      email: "owner@example.test",
      providerIds: ["password"],
      customClaims: { unrelated: "preserved" },
    };
    gateway = {
      getUser: vi.fn().mockResolvedValue(user),
      getUserByEmail: vi.fn().mockResolvedValue(user),
      setCustomUserClaims: vi.fn(),
      revokeRefreshTokens: vi.fn(),
    };
    service = new AdminConsoleClaimsService(gateway);
  });

  it("verifies by UID or email without mutating claims", async () => {
    const byUid = await service.verify({ uid: "existing-user-123456" });
    const byEmail = await service.verify({ email: "owner@example.test" });

    expect(byUid).toEqual(byEmail);
    expect(byUid.target).toBe("uid:***123456");
    expect(byUid.approved).toBe(false);
    expect(gateway.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("requires explicit production confirmation for grants and removals", async () => {
    await expect(
      service.grant({ uid: "existing-user-123456" }, "super_admin", false),
    ).rejects.toThrow("Production mutation refused");
    await expect(
      service.remove({ uid: "existing-user-123456" }, false),
    ).rejects.toThrow("Production mutation refused");
    expect(gateway.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("grants only an approved role and preserves unrelated claims", async () => {
    const result = await service.grant(
      { email: "owner@example.test" },
      "super_admin",
      true,
    );

    expect(result.changed).toBe(true);
    expect(gateway.setCustomUserClaims).toHaveBeenCalledWith(
      "existing-user-123456",
      { unrelated: "preserved", role: "super_admin" },
    );
    expect(gateway.revokeRefreshTokens).toHaveBeenCalledWith(
      "existing-user-123456",
    );
  });

  it("removes only the role and revokes refresh tokens", async () => {
    vi.mocked(gateway.getUser).mockResolvedValue({
      uid: "existing-user-123456",
      email: "owner@example.test",
      providerIds: ["password"],
      customClaims: { unrelated: "preserved", role: "safety_admin" },
    });

    const result = await service.remove({ uid: "existing-user-123456" }, true);

    expect(result.changed).toBe(true);
    expect(gateway.setCustomUserClaims).toHaveBeenCalledWith(
      "existing-user-123456",
      { unrelated: "preserved" },
    );
    expect(gateway.revokeRefreshTokens).toHaveBeenCalled();
  });

  it("refuses anonymous and non-password users", async () => {
    vi.mocked(gateway.getUser).mockResolvedValue({
      uid: "anonymous-user",
      email: null,
      providerIds: [],
      customClaims: {},
    });

    await expect(service.verify({ uid: "anonymous-user" })).rejects.toThrow(
      "existing non-anonymous Firebase Email/Password user",
    );
  });

  it("rejects roles that cannot enter the admin console", async () => {
    await expect(
      service.grant({ uid: "existing-user-123456" }, "support", true),
    ).rejects.toThrow("Role must be one of");
    expect(gateway.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
