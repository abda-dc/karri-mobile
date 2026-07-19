import { vi } from "vitest";

// Mock react-native globally to prevent Rolldown parse crash
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Mocks to prevent loading the actual native Firebase modules in Node Vitest runtime
const mockGetApp = vi.fn();
const mockInitializeAppCheck = vi.fn();
const mockGetToken = vi.fn();
const mockReactNativeFirebaseAppCheckProvider = vi.fn();

vi.mock("@react-native-firebase/app", () => ({
  getApp: mockGetApp,
}));

vi.mock("@react-native-firebase/app-check", () => ({
  initializeAppCheck: mockInitializeAppCheck,
  getToken: mockGetToken,
  ReactNativeFirebaseAppCheckProvider: mockReactNativeFirebaseAppCheckProvider,
}));

describe("NativeAppCheckTokenProvider", () => {
  let NativeAppCheckTokenProvider: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetApp.mockReturnValue({ name: "mock-app" });
    mockInitializeAppCheck.mockResolvedValue({ app: { name: "mock-app" } });

    // Import the native provider dynamically after mocks are configured
    const module = await import("./appCheckTokenProvider.native");
    NativeAppCheckTokenProvider = module.NativeAppCheckTokenProvider;
  });

  afterEach(() => {
    (globalThis as any).__DEV__ = true;
  });

  it("selects debug provider in Android development build", async () => {
    (globalThis as any).__DEV__ = true;
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new NativeAppCheckTokenProvider();
    await providerInstance.getToken(false);

    expect(mockReactNativeFirebaseAppCheckProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        android: { provider: "debug" },
      })
    );
  });

  it("selects playIntegrity in Android production build", async () => {
    (globalThis as any).__DEV__ = false;
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new NativeAppCheckTokenProvider();
    await providerInstance.getToken(false);

    expect(mockReactNativeFirebaseAppCheckProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        android: { provider: "playIntegrity" },
      })
    );
  });

  it("selects appAttestWithDeviceCheckFallback in Apple production build", async () => {
    (globalThis as any).__DEV__ = false;
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new NativeAppCheckTokenProvider();
    await providerInstance.getToken(false);

    expect(mockReactNativeFirebaseAppCheckProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        apple: { provider: "appAttestWithDeviceCheckFallback" },
      })
    );
  });

  it("performs native initialization exactly once across multiple invocations", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new NativeAppCheckTokenProvider();
    await providerInstance.getToken(false);
    await providerInstance.getToken(false);

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it("shares the same initialization promise for concurrent token requests", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    // Yield control using microtask queue rather than event loop macros task (setTimeout)
    mockInitializeAppCheck.mockImplementation(async () => {
      await Promise.resolve();
      return { app: {} };
    });

    const providerInstance = new NativeAppCheckTokenProvider();
    const [res1, res2] = await Promise.all([
      providerInstance.getToken(false),
      providerInstance.getToken(false),
    ]);

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
    expect(res1.token).toBe("valid.jwt.token");
    expect(res2.token).toBe("valid.jwt.token");
  });

  it("forwards the forceRefresh flag to native getToken", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new NativeAppCheckTokenProvider();
    await providerInstance.getToken(true);

    expect(mockGetToken).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it("fails closed with provider-unavailable when native module fails to load", async () => {
    mockInitializeAppCheck.mockRejectedValue(new Error("Native module missing"));

    const providerInstance = new NativeAppCheckTokenProvider();
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/provider-unavailable"
    );
  });

  it("fails closed with provider-unavailable when native module initialization fails, preventing sentinel leak", async () => {
    const sentinel = "SECRET_SENTINEL_INIT_FAIL_12345";
    const sdkError = new Error(`Failed to initialize Native SDK: ${sentinel}`);
    sdkError.stack = `Error: ${sentinel}\n at Object.initializeAppCheck (mock.js:1:1)`;
    mockInitializeAppCheck.mockRejectedValue(sdkError);

    const logSpy = vi.spyOn(console, "log");
    const infoSpy = vi.spyOn(console, "info");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const providerInstance = new NativeAppCheckTokenProvider();
    try {
      await providerInstance.getToken(false);
      expect.fail("Should have failed closed");
    } catch (err: any) {
      expect(err.name).toBe("AppCheckTokenProviderError");
      expect(err.code).toBe("app-check/provider-unavailable");
      expect(err.message).toBe("app-check/provider-unavailable");
      expect(err.message).not.toContain(sentinel);
      expect(err.stack).not.toContain(sentinel);
      expect(err.cause).toBeUndefined();

      // Check console methods
      for (const spy of [logSpy, infoSpy, warnSpy, errorSpy]) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            expect(String(arg)).not.toContain(sentinel);
          }
        }
      }
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("fails closed with invalid-token when token retrieval rejects, preventing sentinel leak", async () => {
    const sentinel = "SECRET_SENTINEL_RETRIEVAL_FAIL_67890";
    const sdkError = new Error(`Failed to get App Check token: ${sentinel}`);
    sdkError.stack = `Error: ${sentinel}\n at Object.getToken (mock.js:1:1)`;
    mockGetToken.mockRejectedValue(sdkError);

    const logSpy = vi.spyOn(console, "log");
    const infoSpy = vi.spyOn(console, "info");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const providerInstance = new NativeAppCheckTokenProvider();
    try {
      await providerInstance.getToken(false);
      expect.fail("Should have failed closed");
    } catch (err: any) {
      expect(err.name).toBe("AppCheckTokenProviderError");
      expect(err.code).toBe("app-check/invalid-token");
      expect(err.message).toBe("app-check/invalid-token");
      expect(err.message).not.toContain(sentinel);
      expect(err.stack).not.toContain(sentinel);
      expect(err.cause).toBeUndefined();

      // Check console methods
      for (const spy of [logSpy, infoSpy, warnSpy, errorSpy]) {
        for (const call of spy.mock.calls) {
          for (const arg of call) {
            expect(String(arg)).not.toContain(sentinel);
          }
        }
      }
    } finally {
      logSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("rejects empty, malformed, or whitespace-containing tokens", async () => {
    const providerInstance = new NativeAppCheckTokenProvider();

    // Empty
    mockGetToken.mockResolvedValue({ token: "" });
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/invalid-token"
    );

    // Leading whitespace
    mockGetToken.mockResolvedValue({ token: " token" });
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/invalid-token"
    );

    // Embedded whitespace
    mockGetToken.mockResolvedValue({ token: "tok en" });
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/invalid-token"
    );

    // Control characters (using a non-whitespace control character \u0000)
    mockGetToken.mockResolvedValue({ token: "token\u0000" });
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/invalid-token"
    );
  });

  it("never includes the raw token in thrown errors or application logs", async () => {
    const SECRET_TOKEN = "secret.leaked.token "; // space at the end to trigger failure
    mockGetToken.mockResolvedValue({ token: SECRET_TOKEN });

    const providerInstance = new NativeAppCheckTokenProvider();
    try {
      await providerInstance.getToken(false);
      expect.fail("Should have failed validation");
    } catch (err: any) {
      expect(err.message).not.toContain(SECRET_TOKEN);
    }
  });
});
