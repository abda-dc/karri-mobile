import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  assertLiveSmokeEnvironment,
  assertNoSecretLeak,
  deriveOperationId,
  parseAnonymousSignUpResponse,
  parseRefreshTokenResponse,
  runPlaceAdministrativeHoldSmoke,
  SmokeTestAndCleanupError,
  type CallableResponse,
  type SmokeDependencies,
} from "../src/liveSmoke/PlaceAdministrativeHoldSmoke.js";

const env = {
  FIREBASE_PROJECT_ID: "karri-mobile-dev",
  KARRI_ALLOW_LIVE_SMOKE: "karri-mobile-dev",
  FIREBASE_WEB_API_KEY: "unit-test-api-key",
};

describe("PlaceAdministrativeHoldSmoke", () => {
  let deps: SmokeDependencies;
  let holds: Map<string, any>;
  let audits: Map<string, any>;
  let shipments: Map<string, any>;
  let users: Set<string>;
  let deletedUsers: string[];
  let signUpCount: number;
  let throwOnAuditLookupAfterDelete: boolean;
  let logSpy: any;
  let errorSpy: any;

  beforeEach(() => {
    holds = new Map();
    audits = new Map();
    shipments = new Map();
    users = new Set();
    deletedUsers = [];
    signUpCount = 0;
    throwOnAuditLookupAfterDelete = false;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    deps = {
      idFactory: () => "unit-run",
      logger: console,
      auth: {
        getUser: vi.fn(async (uid: string) => {
          return users.has(uid) ? { uid } : null;
        }),
        setCustomClaims: vi.fn(),
        revokeRefreshTokens: vi.fn(),
        deleteUser: vi.fn(async (uid: string) => {
          users.delete(uid);
          deletedUsers.push(uid);
        }),
      },
      identityToolkit: {
        signUpAnonymous: vi.fn(async () => {
          signUpCount += 1;
          const uid = signUpCount === 1 ? "identity-toolkit-non-admin-uid" : "identity-toolkit-admin-uid";
          users.add(uid);
          return {
            uid,
            idToken: signUpCount === 1 ? "id-token-for-non-admin" : "id-token-before-claim-refresh",
            refreshToken: signUpCount === 1 ? "refresh-token-for-non-admin" : "refresh-token-for-admin",
          };
        }),
        refreshIdToken: vi.fn(async (refreshToken: string) => {
          return {
            uid: "identity-toolkit-admin-uid",
            idToken: `refreshed-id-token-for-${refreshToken}`,
            refreshToken: `rotated-${refreshToken}`,
          };
        }),
      },
      callable: {
        callPlaceAdministrativeHold: vi.fn(async (idToken: string, payload): Promise<CallableResponse> => {
          if (idToken === "id-token-for-non-admin") {
            return { ok: false, status: "PERMISSION_DENIED" };
          }
          const adminUid = "identity-toolkit-admin-uid";
          const holdId = deriveOperationId(adminUid, "hold.place", "shipment", payload.shipmentId, payload.idempotencyKey);
          const alreadyExisted = holds.has(holdId);
          if (!alreadyExisted) {
            holds.set(holdId, {
              shipmentId: payload.shipmentId,
              status: "active",
              reasonCode: payload.reasonCode,
              note: payload.note,
              placedByUid: adminUid,
              placedByRole: "operations_admin",
              releasedByUid: null,
              idempotencyKey: payload.idempotencyKey,
            });
            audits.set(holdId, {
              action: "hold.place",
              actorUid: adminUid,
              actorRole: "operations_admin",
              targetType: "shipment",
              targetId: payload.shipmentId,
              reasonCode: payload.reasonCode,
              idempotencyKey: payload.idempotencyKey,
            });
          }
          return { ok: true, result: { success: true, holdId, alreadyExisted } };
        }),
      },
      firestore: {
        setShipment: vi.fn(async (shipmentId: string, data: Record<string, unknown>) => {
          shipments.set(shipmentId, data);
        }),
        getShipment: vi.fn(async (shipmentId: string) => shipments.get(shipmentId) || null),
        getAdministrativeHold: vi.fn(async (holdId: string) => holds.get(holdId) || null),
        getAuditLog: vi.fn(async (auditId: string) => {
          if (throwOnAuditLookupAfterDelete && !audits.has(auditId)) {
            throw new Error("lookup failed");
          }
          return audits.get(auditId) || null;
        }),
        countAdministrativeHoldsByShipment: vi.fn(async (shipmentId: string) => {
          return [...holds.values()].filter((hold) => hold.shipmentId === shipmentId).length;
        }),
        countAuditLogsByOperation: vi.fn(async (action: string, targetType: string, targetId: string, idempotencyKey: string) => {
          return [...audits.values()].filter((audit) =>
            audit.action === action &&
            audit.targetType === targetType &&
            audit.targetId === targetId &&
            audit.idempotencyKey === idempotencyKey
          ).length;
        }),
        deleteShipment: vi.fn(async (shipmentId: string) => {
          shipments.delete(shipmentId);
        }),
        deleteAdministrativeHold: vi.fn(async (holdId: string) => {
          holds.delete(holdId);
        }),
        deleteAuditLog: vi.fn(async (auditId: string) => {
          audits.delete(auditId);
        }),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hard fails unless the development project guard matches exactly", () => {
    expect(() => assertLiveSmokeEnvironment({ ...env, FIREBASE_PROJECT_ID: "development" })).toThrow("FIREBASE_PROJECT_ID");
    expect(() => assertLiveSmokeEnvironment({ ...env, FIREBASE_PROJECT_ID: "karri-mobile-prod" })).toThrow("FIREBASE_PROJECT_ID");
  });

  it("hard fails unless the explicit live-smoke opt-in guard matches exactly", () => {
    expect(() => assertLiveSmokeEnvironment({ ...env, KARRI_ALLOW_LIVE_SMOKE: "true" })).toThrow("KARRI_ALLOW_LIVE_SMOKE");
  });

  it("requires the Firebase Web API key without exposing it", () => {
    expect(() => assertLiveSmokeEnvironment({ ...env, FIREBASE_WEB_API_KEY: "" })).toThrow("FIREBASE_WEB_API_KEY");
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining("unit-test-api-key"));
  });

  it("detects accidental secret output", () => {
    expect(() => assertNoSecretLeak("safe output", ["secret-token"])).not.toThrow();
    expect(() => assertNoSecretLeak("unsafe secret-token output", ["secret-token"])).toThrow("Secret value");
  });

  it("parses anonymous Identity Toolkit sign-up success", () => {
    expect(parseAnonymousSignUpResponse({
      localId: "anonymous-user",
      idToken: "memory-only-id-token",
      refreshToken: "memory-only-refresh-token",
    })).toEqual({
      uid: "anonymous-user",
      idToken: "memory-only-id-token",
      refreshToken: "memory-only-refresh-token",
    });
  });

  it("rejects malformed anonymous sign-up responses", () => {
    expect(() => parseAnonymousSignUpResponse({ localId: "anonymous-user" })).toThrow("anonymous sign-up failed");
    expect(() => parseAnonymousSignUpResponse(null)).toThrow("anonymous sign-up failed");
  });

  it("runs cleanup after anonymous sign-up fails mid-run", async () => {
    deps.identityToolkit.signUpAnonymous = vi.fn(async () => {
      signUpCount += 1;
      if (signUpCount === 2) {
        throw new Error("Identity Toolkit anonymous sign-up failed: OPERATION_NOT_ALLOWED");
      }
      users.add("identity-toolkit-non-admin-uid");
      return {
        uid: "identity-toolkit-non-admin-uid",
        idToken: "id-token-for-non-admin",
        refreshToken: "refresh-token-for-non-admin",
      };
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("anonymous sign-up failed");
    expect(deps.auth.deleteUser).toHaveBeenCalledWith("identity-toolkit-non-admin-uid");
    expect(deps.auth.deleteUser).not.toHaveBeenCalledWith("identity-toolkit-admin-uid");
    expect(users.size).toBe(0);
  });

  it("parses Secure Token refresh success", () => {
    expect(parseRefreshTokenResponse({
      user_id: "admin-user",
      id_token: "refreshed-id-token",
      refresh_token: "rotated-refresh-token",
    })).toEqual({
      uid: "admin-user",
      idToken: "refreshed-id-token",
      refreshToken: "rotated-refresh-token",
    });
  });

  it("rejects malformed Secure Token refresh responses", () => {
    expect(() => parseRefreshTokenResponse({ user_id: "admin-user" })).toThrow("Secure Token refresh failed");
    expect(() => parseRefreshTokenResponse(undefined)).toThrow("Secure Token refresh failed");
  });

  it("runs cleanup after claim refresh fails", async () => {
    deps.identityToolkit.refreshIdToken = vi.fn(async () => {
      throw new Error("Secure Token refresh failed: INVALID_REFRESH_TOKEN");
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("Secure Token refresh failed");
    expect(deps.auth.deleteUser).toHaveBeenCalledWith("identity-toolkit-admin-uid");
    expect(deps.auth.deleteUser).toHaveBeenCalledWith("identity-toolkit-non-admin-uid");
    expect(users.size).toBe(0);
  });

  it("does not log API keys or tokens from sign-up or refresh flows", async () => {
    await runPlaceAdministrativeHoldSmoke(env, deps);

    const output = [
      ...logSpy.mock.calls.flat(),
      ...errorSpy.mock.calls.flat(),
    ].join("\n");
    assertNoSecretLeak(output, [
      "unit-test-api-key",
      "id-token-for-non-admin",
      "refresh-token-for-non-admin",
      "id-token-before-claim-refresh",
      "refresh-token-for-admin",
      "refreshed-id-token-for-refresh-token-for-admin",
      "rotated-refresh-token-for-admin",
    ]);
  });

  it("runs denial, success, verification, idempotency, and cleanup-on-success", async () => {
    const result = await runPlaceAdministrativeHoldSmoke(env, deps);

    expect(result.runId).toBe("m32p3-smoke-unit-run");
    expect(deps.identityToolkit.signUpAnonymous).toHaveBeenCalledTimes(2);
    expect(deps.identityToolkit.signUpAnonymous).toHaveBeenCalledWith("unit-test-api-key");
    expect(deps.auth.setCustomClaims).toHaveBeenCalledWith("identity-toolkit-admin-uid", { role: "operations_admin" });
    expect(deps.identityToolkit.refreshIdToken).toHaveBeenCalledWith("refresh-token-for-admin", "unit-test-api-key");
    expect(deps.callable.callPlaceAdministrativeHold).toHaveBeenCalledTimes(3);
    expect(deps.callable.callPlaceAdministrativeHold).toHaveBeenNthCalledWith(1, "id-token-for-non-admin", expect.any(Object));
    expect(deps.callable.callPlaceAdministrativeHold).toHaveBeenNthCalledWith(
      2,
      "refreshed-id-token-for-refresh-token-for-admin",
      expect.any(Object)
    );
    expect(deps.firestore.countAdministrativeHoldsByShipment).toHaveBeenCalledWith("m32p3-smoke-unit-run-shipment");
    expect(deps.firestore.countAuditLogsByOperation).toHaveBeenCalledWith(
      "hold.place",
      "shipment",
      "m32p3-smoke-unit-run-shipment",
      "m32p3-smoke-unit-run-hold"
    );
    expect(holds.size).toBe(0);
    expect(audits.size).toBe(0);
    expect(shipments.size).toBe(0);
    expect(users.size).toBe(0);
    expect(deps.firestore.getAuditLog).toHaveBeenCalledTimes(3);
    expect(deps.firestore.getAdministrativeHold).toHaveBeenCalledTimes(3);
    expect(deps.firestore.getShipment).toHaveBeenCalledWith("m32p3-smoke-unit-run-shipment");
    expect(deps.auth.getUser).toHaveBeenCalledWith("identity-toolkit-admin-uid");
    expect(deps.auth.getUser).toHaveBeenCalledWith("identity-toolkit-non-admin-uid");
    expect(deletedUsers).toEqual([
      "identity-toolkit-admin-uid",
      "identity-toolkit-non-admin-uid",
    ]);
    expect("createCustomToken" in deps.auth).toBe(false);
  });

  it("runs cleanup-on-failure and exits through the failure path", async () => {
    deps.callable.callPlaceAdministrativeHold = vi.fn(async (): Promise<CallableResponse> => {
      return { ok: false, status: "INTERNAL" };
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("Expected PERMISSION_DENIED");
    expect(deps.auth.deleteUser).toHaveBeenCalledWith("identity-toolkit-non-admin-uid");
    expect(deps.firestore.deleteShipment).not.toHaveBeenCalled();
  });

  it("fails the run when cleanup fails", async () => {
    deps.firestore.deleteAuditLog = vi.fn(async () => {
      throw new Error("delete failed");
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("cleanup failed");
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining("unit-test-api-key"));
  });

  it("preserves the primary smoke failure when cleanup also fails", async () => {
    deps.callable.callPlaceAdministrativeHold = vi.fn(async (): Promise<CallableResponse> => {
      return { ok: false, status: "INTERNAL" };
    });
    deps.auth.deleteUser = vi.fn(async () => {
      throw new Error("cleanup user delete failed");
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toMatchObject({
      name: "SmokeTestAndCleanupError",
      primaryError: expect.objectContaining({
        message: expect.stringContaining("Expected PERMISSION_DENIED"),
      }),
      cleanupError: expect.objectContaining({
        message: expect.stringContaining("Live smoke cleanup failed"),
      }),
    } satisfies Partial<SmokeTestAndCleanupError>);
  });

  it("fails cleanup when a Firestore smoke document still exists after delete", async () => {
    deps.firestore.deleteAuditLog = vi.fn(async () => {
      // Simulate a delete call that returned without removing the document.
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("Live smoke cleanup failed");
  });

  it("fails cleanup when a temporary Auth user still exists after delete", async () => {
    deps.auth.deleteUser = vi.fn(async (uid: string) => {
      deletedUsers.push(uid);
    });

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("Live smoke cleanup failed");
  });

  it("fails cleanup on unexpected post-delete verification lookup errors", async () => {
    throwOnAuditLookupAfterDelete = true;

    await expect(runPlaceAdministrativeHoldSmoke(env, deps)).rejects.toThrow("Live smoke cleanup failed");
  });
});
