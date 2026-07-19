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
    getCurrentUser: () => ({ getIdToken }),
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
      authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
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
      authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
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
          details: { credential: AUTH_TOKEN, nested: [APP_CHECK_TOKEN] },
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
        authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
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
        authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
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
        authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
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
        authProvider: { getCurrentUser: () => ({ getIdToken: async () => AUTH_TOKEN }) },
        fetchImplementation: fetchImplementation as typeof fetch,
        projectId: "karri-test",
        allowDevelopmentBypass: false,
      });

      await expect(transport.placeAdministrativeHold(placePayload)).rejects.toBeInstanceOf(AppCheckTokenProviderError);
      expect(fetchImplementation).not.toHaveBeenCalled();
    });
  });
});
