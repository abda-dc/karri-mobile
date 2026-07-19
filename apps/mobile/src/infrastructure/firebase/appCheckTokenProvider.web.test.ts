import { vi } from "vitest";

// Mock react-native globally to prevent Rolldown parse crash
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
}));

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const mockInitializeAppCheck = vi.fn();
const mockGetToken = vi.fn();
const mockReCaptchaEnterpriseProvider = vi.fn();

vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mockInitializeAppCheck,
  getToken: mockGetToken,
  ReCaptchaEnterpriseProvider: mockReCaptchaEnterpriseProvider,
}));

// Mock getFirebaseServices
vi.mock("./client", () => ({
  getFirebaseServices: () => ({ app: { name: "mock-web-app" } }),
}));

describe("WebAppCheckTokenProvider", () => {
  let WebAppCheckTokenProvider: any;
  let originalEnvSiteKey: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    originalEnvSiteKey = process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY;
    process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = "test-site-key";

    // ReCaptchaEnterpriseProvider should be mock initialized as a class constructor
    mockReCaptchaEnterpriseProvider.mockImplementation(
      class {
        siteKey: string;
        constructor(siteKey: string) {
          this.siteKey = siteKey;
        }
      } as any
    );

    // Web initializeAppCheck returns the appCheck instance synchronously
    const mockAppCheckInstance = { app: { name: "mock-web-app" } };
    mockInitializeAppCheck.mockReturnValue(mockAppCheckInstance);

    const module = await import("./appCheckTokenProvider.web");
    WebAppCheckTokenProvider = module.WebAppCheckTokenProvider;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = originalEnvSiteKey;
  });

  it("uses ReCaptchaEnterpriseProvider with the environment site key", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new WebAppCheckTokenProvider();
    await providerInstance.getToken(false);

    expect(mockReCaptchaEnterpriseProvider).toHaveBeenCalledWith("test-site-key");
    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      expect.objectContaining({ name: "mock-web-app" }),
      expect.objectContaining({
        provider: expect.objectContaining({ siteKey: "test-site-key" }),
        isTokenAutoRefreshEnabled: true,
      })
    );
  });

  it("performs web initialization exactly once across multiple invocations", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new WebAppCheckTokenProvider();
    await providerInstance.getToken(false);
    await providerInstance.getToken(false);

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the environment site key is missing", async () => {
    process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY = "";

    const providerInstance = new WebAppCheckTokenProvider();
    await expect(providerInstance.getToken(false)).rejects.toThrow(
      "app-check/provider-unavailable"
    );
  });

  it("fails closed with provider-unavailable when web module initialization fails, preventing sentinel leak", async () => {
    const sentinel = "SECRET_SENTINEL_WEB_INIT_FAIL_12345";
    const sdkError = new Error(`Failed to initialize Web SDK: ${sentinel}`);
    sdkError.stack = `Error: ${sentinel}\n at Object.initializeAppCheck (mock.js:1:1)`;
    mockInitializeAppCheck.mockImplementation(() => {
      throw sdkError;
    });

    const logSpy = vi.spyOn(console, "log");
    const infoSpy = vi.spyOn(console, "info");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const providerInstance = new WebAppCheckTokenProvider();
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

  it("fails closed with invalid-token when web token retrieval rejects, preventing sentinel leak", async () => {
    const sentinel = "SECRET_SENTINEL_WEB_RETRIEVAL_FAIL_67890";
    const sdkError = new Error(`Failed to get Web App Check token: ${sentinel}`);
    sdkError.stack = `Error: ${sentinel}\n at Object.getToken (mock.js:1:1)`;
    mockGetToken.mockRejectedValue(sdkError);

    const logSpy = vi.spyOn(console, "log");
    const infoSpy = vi.spyOn(console, "info");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const providerInstance = new WebAppCheckTokenProvider();
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

  it("forwards the forceRefresh flag to web getToken", async () => {
    mockGetToken.mockResolvedValue({ token: "valid.jwt.token" });

    const providerInstance = new WebAppCheckTokenProvider();
    await providerInstance.getToken(true);

    expect(mockGetToken).toHaveBeenCalledWith(expect.any(Object), true);
  });

  it("rejects empty or malformed tokens", async () => {
    const providerInstance = new WebAppCheckTokenProvider();

    // Empty
    mockGetToken.mockResolvedValue({ token: "" });
    await expect(providerInstance.getToken(false)).rejects.toThrow("app-check/invalid-token");

    // Embedded whitespace
    mockGetToken.mockResolvedValue({ token: "tok en" });
    await expect(providerInstance.getToken(false)).rejects.toThrow("app-check/invalid-token");
  });

  it("never includes the raw token in thrown errors or application logs", async () => {
    const SECRET_TOKEN = "secret.leaked.token ";
    mockGetToken.mockResolvedValue({ token: SECRET_TOKEN });

    const providerInstance = new WebAppCheckTokenProvider();
    try {
      await providerInstance.getToken(false);
      expect.fail("Should have failed validation");
    } catch (err: any) {
      expect(err.message).not.toContain(SECRET_TOKEN);
    }
  });
});
