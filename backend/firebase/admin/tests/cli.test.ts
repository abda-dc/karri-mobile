import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { main } from "../src/cli.js";

describe("CLI handler", () => {
  let mockGateway: any;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    mockGateway = {
      getUser: vi.fn().mockResolvedValue({
        uid: "test-user-123",
        customClaims: { role: "support" },
      }),
      setCustomUserClaims: vi.fn(),
      revokeRefreshTokens: vi.fn(),
    };

    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exit code 1 when command is missing", async () => {
    const code = await main([]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Command is required"));
  });

  it("returns exit code 1 when uid is missing", async () => {
    const code = await main(["get"]);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("'--uid <uid>' is required"));
  });

  it("returns exit code 1 when setting role without --role", async () => {
    const code = await main(["set", "--uid", "user-123"], mockGateway);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("'--role <role>' is required"));
  });

  it("returns exit code 1 when bootstrapping without --confirm-super-admin-bootstrap", async () => {
    const code = await main(["bootstrap", "--uid", "user-123"], mockGateway);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Accidental execution safeguard"));
  });

  it("runs get successfully and prints JSON without printing secrets", async () => {
    const code = await main(["get", "--uid", "user-123"], mockGateway);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('"role": "support"'));

    const loggedText = logSpy.mock.calls.flat().join(" ");
    expect(loggedText).not.toContain("passwordHash");
    expect(loggedText).not.toContain("passwordSalt");
  });

  it("runs bootstrap successfully when confirm flag is present", async () => {
    const code = await main(["bootstrap", "--uid", "user-123", "--confirm-super-admin-bootstrap"], mockGateway);
    expect(code).toBe(0);
    expect(mockGateway.setCustomUserClaims).toHaveBeenCalledWith("user-123", { role: "super_admin" });
  });

  it("handles no-op set role requests gracefully", async () => {
    mockGateway.getUser = vi.fn().mockResolvedValue({
      uid: "user-123",
      customClaims: { role: "moderator" },
    });

    const code = await main(["set", "--uid", "user-123", "--role", "moderator"], mockGateway);
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No Change: Role is already set"));
    expect(mockGateway.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
