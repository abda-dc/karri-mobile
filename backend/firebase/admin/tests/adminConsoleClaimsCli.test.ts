import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FirebaseAdminConsoleGateway } from "../src/gateways/FirebaseAdminGateway.js";
import { main } from "../src/adminConsoleClaimsCli.js";

describe("admin console claims CLI", () => {
  let gateway: FirebaseAdminConsoleGateway;
  let logSpy: any;
  let errorSpy: any;

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
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("supports read-only verification with a redacted result", async () => {
    const code = await main(
      ["verify", "--project-id", "karri-prod", "--email", "owner@example.test"],
      gateway,
    );

    expect(code).toBe(0);
    const output = logSpy.mock.calls.flat().join(" ");
    expect(output).toContain("uid:***123456");
    expect(output).not.toContain("owner@example.test");
    expect(output).not.toContain("preserved");
  });

  it("refuses a production grant without confirmation", async () => {
    const code = await main(
      [
        "grant",
        "--project-id",
        "karri-prod",
        "--uid",
        "existing-user-123456",
        "--role",
        "super_admin",
      ],
      gateway,
    );

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Production mutation refused"),
    );
    expect(gateway.setCustomUserClaims).not.toHaveBeenCalled();
  });

  it("requires exactly one selector", async () => {
    const code = await main(
      [
        "verify",
        "--project-id",
        "karri-prod",
        "--uid",
        "existing-user-123456",
        "--email",
        "owner@example.test",
      ],
      gateway,
    );

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Provide exactly one target"),
    );
  });
});
