// Production regression and transport verification suite
import { vi } from "vitest";

// Mock react-native globally to prevent Rolldown parse crash
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import { afterEach, describe, expect, it } from "vitest";
import { AppCheckTokenProviderError, UnavailableAppCheckTokenProvider } from "./appCheckTokenProvider";
import {
  PrivilegedCallableError,
  PrivilegedCallableTransport,
  type CallableAuthProvider,
} from "./privilegedCallableTransport";

const AUTH_TOKEN = "auth.header.payload";
const APP_CHECK_TOKEN = "appcheck.header.payload";
const placePayload = {
  shipmentId: "shipment-1",
  reasonCode: "suspected_policy_violation",
  note: "review",
  idempotencyKey: "idempotency-1",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createHarness(responses: Response[]) {
  const getIdToken = vi.fn(async (_forceRefresh?: boolean) => AUTH_TOKEN);
  const getAppCheckToken = vi.fn(async (_forceRefresh: boolean) => ({ token: APP_CHECK_TOKEN }));
  const fetchImplementation = vi.fn(async () => responses.shift() ?? jsonResponse({ result: {} }));
  const authProvider: CallableAuthProvider = {
    getCurrentUser: () => ({ uid: "user-current", getIdToken }),
  };
  const transport = new PrivilegedCallableTransport({
    appCheckTokenProvider: { getToken: getAppCheckToken },
    authProvider,
    fetchImplementation: fetchImplementation as typeof fetch,
    projectId: "karri-test",
  });
  return { fetchImplementation, getAppCheckToken, getIdToken, transport };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrivilegedCallableTransport", () => {
  it("sends the required endpoint, credentials, and callable request envelope", async () => {
    const harness = createHarness([jsonResponse({ result: { success: true, holdId: "hold-1", alreadyExisted: false } })]);

    await expect(harness.transport.placeAdministrativeHold(placePayload)).resolves.toEqual({
      success: true,
      holdId: "hold-1",
      alreadyExisted: false,
    });

    expect(harness.fetchImplementation).toHaveBeenCalledWith(
      "https://us-east1-karri-test.cloudfunctions.net/placeAdministrativeHold",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          "Content-Type": "application/json",
          "X-Firebase-AppCheck": APP_CHECK_TOKEN,
        },
        body: JSON.stringify({ data: placePayload }),
      },
    );
  });

  it("normalizes callable errors", async () => {
    const harness = createHarness([
      jsonResponse({ error: { status: "FAILED_PRECONDITION", message: "Shipment state changed.", details: { state: "closed" } } }, 400),
    ]);

    await expect(harness.transport.placeAdministrativeHold(placePayload)).rejects.toMatchObject({
      code: "callable/failed-precondition",
      callableCode: "FAILED_PRECONDITION",
      details: { state: "closed" },
      httpStatus: 400,
      message: "Shipment state changed.",
      retryable: false,
    });
  });

  it("fails closed when the user is signed out", async () => {
    const transport = new PrivilegedCallableTransport({
      appCheckTokenProvider: { getToken: vi.fn() },
      authProvider: { getCurrentUser: () => null },
      fetchImplementation: vi.fn() as typeof fetch,
      projectId: "karri-test",
    });

    await expect(transport.placeAdministrativeHold(placePayload)).rejects.toMatchObject({
      code: "callable/signed-out",
      retryable: false,
    });
  });

  it("fails closed when App Check is unavailable", async () => {
    const transport = new PrivilegedCallableTransport({
      appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
      authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
      fetchImplementation: vi.fn() as typeof fetch,
      projectId: "karri-test",
    });

    await expect(transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(AppCheckTokenProviderError);
    await expect(transport.placeAdministrativeHold(placePayload)).rejects.toMatchObject({ code: "app-check/provider-unavailable" });
  });

  it.each(["", " token with spaces ", "line\nbreak"])("rejects a missing or malformed App Check token: %j", async (token) => {
    const fetchImplementation = vi.fn();
    const transport = new PrivilegedCallableTransport({
      appCheckTokenProvider: { getToken: async () => ({ token }) },
      authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
      fetchImplementation: fetchImplementation as typeof fetch,
      projectId: "karri-test",
    });

    await expect(transport.placeAdministrativeHold(placePayload)).rejects.toMatchObject({ code: "app-check/invalid-token" });
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it("forces one credential refresh and retries once after unauthenticated", async () => {
    const harness = createHarness([
      jsonResponse({ error: { status: "UNAUTHENTICATED", message: "Credential expired." } }, 401),
      jsonResponse({ result: { success: true, holdId: "hold-1", alreadyExisted: false } }),
    ]);

    await expect(harness.transport.placeAdministrativeHold(placePayload)).resolves.toMatchObject({ holdId: "hold-1" });
    expect(harness.fetchImplementation).toHaveBeenCalledTimes(2);
    expect(harness.getIdToken.mock.calls.map(([forceRefresh]) => forceRefresh)).toEqual([false, true]);
    expect(harness.getAppCheckToken.mock.calls.map(([forceRefresh]) => forceRefresh)).toEqual([false, true]);
  });

  it.each(["PERMISSION_DENIED", "INVALID_ARGUMENT", "FAILED_PRECONDITION", "ALREADY_EXISTS"])(
    "does not retry the %s callable failure",
    async (status) => {
      const harness = createHarness([jsonResponse({ error: { status, message: "Rejected." } }, 400)]);

      await expect(harness.transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(PrivilegedCallableError);
      expect(harness.fetchImplementation).toHaveBeenCalledTimes(1);
      expect(harness.getIdToken).toHaveBeenCalledTimes(1);
      expect(harness.getAppCheckToken).toHaveBeenCalledTimes(1);
    },
  );

  it("never exposes credential values through errors or console logging", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const harness = createHarness([
      jsonResponse({
        error: {
          status: "PERMISSION_DENIED",
          message: `Rejected ${AUTH_TOKEN} and ${APP_CHECK_TOKEN}.`,
          details: {
            credential: AUTH_TOKEN,
            nested: [APP_CHECK_TOKEN],
            [AUTH_TOKEN]: "authKeyVal",
            nestedKeys: { [APP_CHECK_TOKEN]: "appCheckKeyVal" },
          },
        },
      }, 403),
    ]);

    let failure: unknown;
    try {
      await harness.transport.placeAdministrativeHold(placePayload);
    } catch (error) {
      failure = error;
    }

    expect(String(failure)).not.toContain(AUTH_TOKEN);
    expect(String(failure)).not.toContain(APP_CHECK_TOKEN);
    expect(JSON.stringify(failure)).not.toContain(AUTH_TOKEN);
    expect(JSON.stringify(failure)).not.toContain(APP_CHECK_TOKEN);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  describe("App Check local bypass environment matrix", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalBypassFlag = process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS;
    const originalDev = (globalThis as any).__DEV__;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
      process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS = originalBypassFlag;
      (globalThis as any).__DEV__ = originalDev;
    });

    it("allows bypassing App Check when in development build AND bypass flag is enabled", async () => {
      (globalThis as any).__DEV__ = true;
      process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS = "true";

      const fetchImplementation = vi.fn(async () => jsonResponse({ result: { success: true, holdId: "hold-1", alreadyExisted: false } }));
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
        authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
        allowDevelopmentBypass: true,
      });

      await expect(transport.placeAdministrativeHold(placePayload)).resolves.toEqual({
        success: true,
        holdId: "hold-1",
        alreadyExisted: false,
      });

      expect(fetchImplementation).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            "X-Firebase-AppCheck": expect.any(String),
          }),
        })
      );
    });

    it("fails closed when in development build but bypass flag is disabled", async () => {
      (globalThis as any).__DEV__ = true;
      process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS = "false";

      const fetchImplementation = vi.fn();
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
        authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
        allowDevelopmentBypass: false,
      });

      await expect(transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(AppCheckTokenProviderError);
      expect(fetchImplementation).not.toHaveBeenCalled();
    });

    it("fails closed when in production build even if bypass flag is enabled", async () => {
      (globalThis as any).__DEV__ = false;
      process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS = "true";

      const fetchImplementation = vi.fn();
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
        authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
        allowDevelopmentBypass: true,
      });

      await expect(transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(AppCheckTokenProviderError);
      expect(fetchImplementation).not.toHaveBeenCalled();
    });

    it("fails closed when in production build and bypass flag is disabled", async () => {
      (globalThis as any).__DEV__ = false;
      process.env.EXPO_PUBLIC_ALLOW_LOCAL_APP_CHECK_BYPASS = "false";

      const fetchImplementation = vi.fn();
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
        authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
        allowDevelopmentBypass: false,
      });

      await expect(transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(AppCheckTokenProviderError);
      expect(fetchImplementation).not.toHaveBeenCalled();
    });
  });

  describe("registerPushToken and unregisterPushToken", () => {
    const pushToken = "ExpoPushToken[sensitive-token-123]";
    const registerPayload = {
      deviceId: "karri-device-123456789012",
      platform: "ios" as const,
      provider: "expo" as const,
      token: pushToken,
      registeredAt: "2026-07-20T10:00:00.000Z",
    };
    const unregisterPayload = {
      deviceId: "karri-device-123456789012",
    };

    it("registerPushToken uses the correct regional endpoint, envelope, payload fields, and headers", async () => {
      const harness = createHarness([
        jsonResponse({ result: { success: true, deviceId: registerPayload.deviceId, status: "registered", alreadyExisted: false } }),
      ]);

      await expect(harness.transport.registerPushToken(registerPayload, "user-current")).resolves.toEqual({
        success: true,
        deviceId: registerPayload.deviceId,
        status: "registered",
        alreadyExisted: false,
      });

      expect(harness.fetchImplementation).toHaveBeenCalledWith(
        "https://us-east1-karri-test.cloudfunctions.net/registerPushToken",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
            "X-Firebase-AppCheck": APP_CHECK_TOKEN,
          },
          body: JSON.stringify({ data: registerPayload }),
        },
      );
    });

    it("unregisterPushToken sends only deviceId", async () => {
      const harness = createHarness([
        jsonResponse({ result: { success: true, deviceId: unregisterPayload.deviceId, status: "unregistered", alreadyInactive: true } }),
      ]);

      await expect(harness.transport.unregisterPushToken(unregisterPayload, "user-current")).resolves.toEqual({
        success: true,
        deviceId: unregisterPayload.deviceId,
        status: "unregistered",
        alreadyInactive: true,
      });

      expect(harness.fetchImplementation).toHaveBeenCalledWith(
        "https://us-east1-karri-test.cloudfunctions.net/unregisterPushToken",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AUTH_TOKEN}`,
            "Content-Type": "application/json",
            "X-Firebase-AppCheck": APP_CHECK_TOKEN,
          },
          body: JSON.stringify({ data: unregisterPayload }),
        },
      );
    });

    it("fails closed before credentials when the active UID changed", async () => {
      const getIdToken = vi.fn(async () => AUTH_TOKEN);
      const getAppCheckToken = vi.fn(async () => ({
        token: APP_CHECK_TOKEN,
      }));
      const fetchImplementation = vi.fn();

      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: {
          getToken: getAppCheckToken,
        },
        authProvider: {
          getCurrentUser: () => ({
            uid: "user-next",
            getIdToken,
          }),
        },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
      });

      await expect(
        transport.unregisterPushToken(
          unregisterPayload,
          "user-previous",
        ),
      ).rejects.toMatchObject({
        code: "callable/user-changed",
        retryable: false,
      });

      expect(getIdToken).not.toHaveBeenCalled();
      expect(getAppCheckToken).not.toHaveBeenCalled();
      expect(fetchImplementation).not.toHaveBeenCalled();
    });

    it("fails closed when user is signed out", async () => {
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: { getToken: vi.fn() },
        authProvider: { getCurrentUser: () => null },
        fetchImplementation: vi.fn() as typeof fetch,
        projectId: "karri-test",
      });

      await expect(transport.registerPushToken(registerPayload, "user-current")).rejects.toMatchObject({
        code: "callable/signed-out",
        retryable: false,
      });
    });

    it("fails closed when App Check is unavailable", async () => {
      const transport = new PrivilegedCallableTransport({
        appCheckTokenProvider: new UnavailableAppCheckTokenProvider(),
        authProvider: { getCurrentUser: () => ({ uid: "user-current", getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: vi.fn() as typeof fetch,
        projectId: "karri-test",
      });

      await expect(transport.registerPushToken(registerPayload, "user-current")).rejects.toBeInstanceOf(AppCheckTokenProviderError);
    });

    it("forces one credential refresh and retries once after unauthenticated", async () => {
      const harness = createHarness([
        jsonResponse({ error: { status: "UNAUTHENTICATED", message: "Expired." } }, 401),
        jsonResponse({ result: { success: true, deviceId: registerPayload.deviceId, status: "registered", alreadyExisted: false } }),
      ]);

      await expect(harness.transport.registerPushToken(registerPayload, "user-current")).resolves.toMatchObject({ status: "registered" });
      expect(harness.fetchImplementation).toHaveBeenCalledTimes(2);
      expect(harness.getIdToken.mock.calls.map(([force]) => force)).toEqual([false, true]);
    });

    it("redacts raw push token appearing as error message substring, nested object value, or nested object key", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

      const harness = createHarness([
        jsonResponse({
          error: {
            status: "INVALID_ARGUMENT",
            message: `The token ${pushToken} is invalid.`,
            details: {
              suppliedToken: pushToken,
              nestedArray: [pushToken],
              [pushToken]: "tokenValueAsKey",
              deepObject: {
                [pushToken]: { nested: pushToken },
              },
            },
          },
        }, 400),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(registerPayload, "user-current");
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(PrivilegedCallableError);
      expect(failure.message).not.toContain(pushToken);
      expect(failure.message).toContain("[REDACTED]");
      expect(failure.details.suppliedToken).toBe("[REDACTED]");
      expect(failure.details.nestedArray[0]).toBe("[REDACTED]");
      expect(failure.details["[REDACTED]"]).toBe("tokenValueAsKey");
      expect(failure.details.deepObject["[REDACTED]"].nested).toBe("[REDACTED]");
      expect(String(failure)).not.toContain(pushToken);
      expect(JSON.stringify(failure)).not.toContain(pushToken);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
    it("redacts raw token appearing in error status", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const tokenInStatus = `INVALID_ARGUMENT_${pushToken}`;
      const harness = createHarness([
        jsonResponse({
          error: {
            status: tokenInStatus,
            message: "Bad request",
          },
        }, 400),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(registerPayload, "user-current");
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(PrivilegedCallableError);
      expect(failure.callableCode).toBe("[REDACTED]");
      expect(failure.message).toBe("Bad request");
      expect(String(failure)).not.toContain(pushToken);
      expect(JSON.stringify(failure)).not.toContain(pushToken);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });

    it("ensures existing administrative callables retain their current error and credential behavior after sensitive-value support", async () => {
      const harness = createHarness([
        jsonResponse({
          error: {
            status: "PERMISSION_DENIED",
            message: "Denied admin access.",
            details: { info: "admin" },
          },
        }, 403),
      ]);

      await expect(harness.transport.placeAdministrativeHold(placePayload)).rejects.toMatchObject({
        code: "callable/permission-denied",
        message: "Denied admin access.",
        details: { info: "admin" },
      });
    });

    it("redacts raw token when error.status is exactly auth.header.payload", async () => {
      const targetToken = "auth.header.payload";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      const harness = createHarness([
        jsonResponse(
          {
            error: {
              status: targetToken,
              message: `Failed for ${targetToken}`,
              details: { token: targetToken },
            },
          },
          400,
        ),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(
          {
            ...registerPayload,
            token: pushToken,
          },
          "user-current",
        );
      } catch (error) {
        failure = error;
      }

      try {
        expect(failure).toBeInstanceOf(PrivilegedCallableError);
        expect(failure.message).not.toContain(targetToken);
        expect(failure.callableCode).not.toContain(targetToken);
        expect(failure.code).not.toContain(targetToken);
        expect(JSON.stringify(failure.details)).not.toContain(targetToken);
        expect(String(failure)).not.toContain(targetToken);
        expect(JSON.stringify(failure)).not.toContain(targetToken);

        console.error(failure);
        console.warn(failure);
        console.log(failure);
        console.info(failure);
        console.debug(failure);

        for (const spy of [errorSpy, warnSpy, logSpy, infoSpy, debugSpy]) {
          expect(spy).toHaveBeenCalledTimes(1);
          for (const callArgs of spy.mock.calls) {
            for (const arg of callArgs) {
              expect(String(arg)).not.toContain(targetToken);
              expect(JSON.stringify(arg)).not.toContain(targetToken);
            }
          }
        }
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
        infoSpy.mockRestore();
        debugSpy.mockRestore();
      }
    });

    it("redacts raw token when error.status is exactly appcheck.header.payload", async () => {
      const targetToken = "appcheck.header.payload";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      const harness = createHarness([
        jsonResponse(
          {
            error: {
              status: targetToken,
              message: `Failed for ${targetToken}`,
              details: { token: targetToken },
            },
          },
          400,
        ),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(
          {
            ...registerPayload,
            token: pushToken,
          },
          "user-current",
        );
      } catch (error) {
        failure = error;
      }

      try {
        expect(failure).toBeInstanceOf(PrivilegedCallableError);
        expect(failure.message).not.toContain(targetToken);
        expect(failure.callableCode).not.toContain(targetToken);
        expect(failure.code).not.toContain(targetToken);
        expect(JSON.stringify(failure.details)).not.toContain(targetToken);
        expect(String(failure)).not.toContain(targetToken);
        expect(JSON.stringify(failure)).not.toContain(targetToken);

        console.error(failure);
        console.warn(failure);
        console.log(failure);
        console.info(failure);
        console.debug(failure);

        for (const spy of [errorSpy, warnSpy, logSpy, infoSpy, debugSpy]) {
          expect(spy).toHaveBeenCalledTimes(1);
          for (const callArgs of spy.mock.calls) {
            for (const arg of callArgs) {
              expect(String(arg)).not.toContain(targetToken);
              expect(JSON.stringify(arg)).not.toContain(targetToken);
            }
          }
        }
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
        infoSpy.mockRestore();
        debugSpy.mockRestore();
      }
    });

    it("redacts raw token when error.status is exactly ExpoPushToken[val123]", async () => {
      const targetToken = "ExpoPushToken[val123]";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      const harness = createHarness([
        jsonResponse(
          {
            error: {
              status: targetToken,
              message: `Failed for ${targetToken}`,
              details: { token: targetToken },
            },
          },
          400,
        ),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(
          {
            ...registerPayload,
            token: targetToken,
          },
          "user-current",
        );
      } catch (error) {
        failure = error;
      }

      try {
        expect(failure).toBeInstanceOf(PrivilegedCallableError);
        expect(failure.message).not.toContain(targetToken);
        expect(failure.callableCode).not.toContain(targetToken);
        expect(failure.code).not.toContain(targetToken);
        expect(JSON.stringify(failure.details)).not.toContain(targetToken);
        expect(String(failure)).not.toContain(targetToken);
        expect(JSON.stringify(failure)).not.toContain(targetToken);

        console.error(failure);
        console.warn(failure);
        console.log(failure);
        console.info(failure);
        console.debug(failure);

        for (const spy of [errorSpy, warnSpy, logSpy, infoSpy, debugSpy]) {
          expect(spy).toHaveBeenCalledTimes(1);
          for (const callArgs of spy.mock.calls) {
            for (const arg of callArgs) {
              expect(String(arg)).not.toContain(targetToken);
              expect(JSON.stringify(arg)).not.toContain(targetToken);
            }
          }
        }
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
        infoSpy.mockRestore();
        debugSpy.mockRestore();
      }
    });

    it("preserves harmless message when error.status is ExpoPushToken[val123] and error.message contains no token", async () => {
      const targetToken = "ExpoPushToken[val123]";
      const harmlessMessage = "Invalid push registration parameters";
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      const harness = createHarness([
        jsonResponse(
          {
            error: {
              status: targetToken,
              message: harmlessMessage,
              details: { ok: true },
            },
          },
          400,
        ),
      ]);

      let failure: any;
      try {
        await harness.transport.registerPushToken(
          {
            ...registerPayload,
            token: targetToken,
          },
          "user-current",
        );
      } catch (error) {
        failure = error;
      }

      try {
        expect(failure).toBeInstanceOf(PrivilegedCallableError);
        expect(failure.callableCode).toBe("[REDACTED]");
        expect(failure.code).toBe("callable/[redacted]");
        expect(failure.message).toBe(harmlessMessage);
        expect(String(failure)).not.toContain(targetToken);
        expect(JSON.stringify(failure)).not.toContain(targetToken);
        expect(JSON.stringify(failure.details)).not.toContain(targetToken);

        console.error(failure);
        console.warn(failure);
        console.log(failure);
        console.info(failure);
        console.debug(failure);

        for (const spy of [errorSpy, warnSpy, logSpy, infoSpy, debugSpy]) {
          expect(spy).toHaveBeenCalledTimes(1);
          for (const callArgs of spy.mock.calls) {
            for (const arg of callArgs) {
              expect(String(arg)).not.toContain(targetToken);
              expect(JSON.stringify(arg)).not.toContain(targetToken);
            }
          }
        }
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        logSpy.mockRestore();
        infoSpy.mockRestore();
        debugSpy.mockRestore();
      }
    });
  });
});
