import { afterEach, describe, expect, it, vi } from "vitest";

const nativeMocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

vi.mock("react-native", () => ({
  Alert: { alert: nativeMocks.alert },
}));

import {
  startWithStartupDiagnostics,
  type StartupErrorHandler,
  type StartupErrorUtils,
} from "./startupDiagnostics";

function errorUtilsHarness(previousHandler?: StartupErrorHandler) {
  let installedHandler: StartupErrorHandler | undefined;
  const errorUtils: StartupErrorUtils = {
    getGlobalHandler: vi.fn(() => previousHandler),
    setGlobalHandler: vi.fn((handler) => {
      installedHandler = handler;
    }),
  };

  return {
    errorUtils,
    getInstalledHandler: () => installedHandler,
  };
}

function pressCloseApp(): void {
  const buttons = nativeMocks.alert.mock.calls[0]?.[2];
  buttons?.[0]?.onPress?.();
}

afterEach(() => {
  vi.restoreAllMocks();
  nativeMocks.alert.mockReset();
});

describe("early startup diagnostics", () => {
  it("installs the ErrorUtils handler before loading Expo Router", () => {
    const order: string[] = [];
    const harness = errorUtilsHarness();
    harness.errorUtils.setGlobalHandler = vi.fn(() => {
      order.push("handler-installed");
    });

    startWithStartupDiagnostics(
      () => order.push("expo-router-entry-loaded"),
      { ErrorUtils: harness.errorUtils },
    );

    expect(order).toEqual([
      "handler-installed",
      "expo-router-entry-loaded",
    ]);
  });

  it("loads Expo Router during normal startup", () => {
    const loadExpoRouterEntry = vi.fn();

    startWithStartupDiagnostics(loadExpoRouterEntry, {});

    expect(loadExpoRouterEntry).toHaveBeenCalledOnce();
    expect(nativeMocks.alert).not.toHaveBeenCalled();
  });

  it("presents exactly one readable Alert for a fatal global error", () => {
    const harness = errorUtilsHarness(vi.fn());
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new TypeError("global failure");
    error.stack = Array.from(
      { length: 15 },
      (_, index) => `    at frame${index} (startup.ts:${index + 1}:1)`,
    ).join("\n");

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(error, true);

    expect(nativeMocks.alert).toHaveBeenCalledOnce();
    expect(nativeMocks.alert).toHaveBeenCalledWith(
      "Karri Startup Diagnostic",
      expect.stringContaining("Phase: global-handler"),
      expect.any(Array),
      { cancelable: false },
    );
    const message = nativeMocks.alert.mock.calls[0][1];
    expect(message).toContain("Error name: TypeError");
    expect(message).toContain("Error message: global failure");
    expect(message).toContain("at frame0");
    expect(message).toContain("at frame9");
    expect(message).not.toContain("at frame10");
    expect(message).toContain(
      "Take screenshots of this message before closing it.",
    );
    expect(nativeMocks.alert.mock.calls[0][2]?.[0]?.text).toBe("Close App");
    expect(log.mock.calls[0][0]).toContain(
      "[KARRI_STARTUP_ERROR] phase=global-handler fatal=true",
    );
  });

  it("waits for Close App before invoking the previous fatal handler", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("wait for tester");

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(error, true);

    expect(previousHandler).not.toHaveBeenCalled();
    pressCloseApp();
    pressCloseApp();
    expect(previousHandler).toHaveBeenCalledOnce();
    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it("delegates nonfatal errors immediately without showing an Alert", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("recoverable failure");

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(error, false);

    expect(nativeMocks.alert).not.toHaveBeenCalled();
    expect(previousHandler).toHaveBeenCalledOnce();
    expect(previousHandler).toHaveBeenCalledWith(error, false);
    expect(log.mock.calls[0][0]).toContain(
      "[KARRI_STARTUP_ERROR] phase=global-handler fatal=false",
    );
  });

  it("presents an Alert instead of immediately rethrowing an entry failure", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("entry failed");

    expect(() =>
      startWithStartupDiagnostics(
        () => {
          throw error;
        },
        { ErrorUtils: harness.errorUtils },
      ),
    ).not.toThrow();

    expect(nativeMocks.alert).toHaveBeenCalledOnce();
    expect(nativeMocks.alert.mock.calls[0][1]).toContain(
      "Phase: entry-require",
    );
    expect(previousHandler).not.toHaveBeenCalled();
    pressCloseApp();
    expect(previousHandler).toHaveBeenCalledWith(error, true);
  });

  it("falls back to the previous handler when Alert presentation fails", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("fatal failure");
    nativeMocks.alert.mockImplementationOnce(() => {
      throw new Error("Alert unavailable");
    });

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(error, true);

    expect(previousHandler).toHaveBeenCalledOnce();
    expect(previousHandler).toHaveBeenCalledWith(error, true);
    expect(log.mock.calls[1][0]).toContain("alert-presentation-failed");
  });

  it("normalizes non-Error values for display but delegates the original value", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = { code: "plain-object" };

    startWithStartupDiagnostics(() => {
      throw original;
    }, { ErrorUtils: harness.errorUtils });

    expect(nativeMocks.alert.mock.calls[0][1]).toContain(
      "Error name: Error",
    );
    expect(nativeMocks.alert.mock.calls[0][1]).toContain(
      "Error message: [object Object]",
    );
    pressCloseApp();
    expect(previousHandler).toHaveBeenCalledWith(original, true);
  });

  it("does not present duplicate Alerts for duplicate fatal callbacks", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("duplicate failure");

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(error, true);
    harness.getInstalledHandler()?.(error, true);

    expect(nativeMocks.alert).toHaveBeenCalledOnce();
    expect(previousHandler).not.toHaveBeenCalled();
  });

  it("does not recurse if presenting the diagnostic triggers ErrorUtils", () => {
    const previousHandler = vi.fn();
    const harness = errorUtilsHarness(previousHandler);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const originalError = new Error("original failure");
    nativeMocks.alert.mockImplementationOnce(() => {
      harness.getInstalledHandler()?.(
        new Error("diagnostic presentation failure"),
        true,
      );
    });

    startWithStartupDiagnostics(() => undefined, {
      ErrorUtils: harness.errorUtils,
    });
    harness.getInstalledHandler()?.(originalError, true);

    expect(nativeMocks.alert).toHaveBeenCalledOnce();
    expect(previousHandler).toHaveBeenCalledOnce();
    expect(previousHandler).toHaveBeenCalledWith(originalError, true);
  });

  it("loads normally when ErrorUtils is unavailable", () => {
    const loadExpoRouterEntry = vi.fn();

    startWithStartupDiagnostics(loadExpoRouterEntry, {
      ErrorUtils: undefined,
    });

    expect(loadExpoRouterEntry).toHaveBeenCalledOnce();
  });

  it("handles an entry failure when ErrorUtils is unavailable", () => {
    const terminate = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("entry failed without ErrorUtils");

    startWithStartupDiagnostics(
      () => {
        throw error;
      },
      {},
      { terminate },
    );

    expect(nativeMocks.alert).toHaveBeenCalledOnce();
    expect(terminate).not.toHaveBeenCalled();
    pressCloseApp();
    expect(terminate).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledWith(error);
  });

  it("terminates with the original error when no previous handler exists", () => {
    const harness = errorUtilsHarness();
    const terminate = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("no previous handler");

    startWithStartupDiagnostics(
      () => undefined,
      { ErrorUtils: harness.errorUtils },
      { terminate },
    );
    harness.getInstalledHandler()?.(error, true);

    expect(terminate).not.toHaveBeenCalled();
    pressCloseApp();
    expect(terminate).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledWith(error);
  });

  it("falls back to termination if Alert fails without a previous handler", () => {
    const harness = errorUtilsHarness();
    const terminate = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("unpresentable failure");
    nativeMocks.alert.mockImplementationOnce(() => {
      throw new Error("Alert unavailable");
    });

    startWithStartupDiagnostics(
      () => {
        throw error;
      },
      { ErrorUtils: harness.errorUtils },
      { terminate },
    );

    expect(terminate).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledWith(error);
  });
});
