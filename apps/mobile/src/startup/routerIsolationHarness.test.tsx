import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Button: "Button",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));

import {
  RouterProbeErrorBoundary,
  createRouterIsolationController,
  installVisibleGlobalErrorCapture,
  type RouterProbeDependencies,
} from "./routerIsolationHarness";

function dependencies(
  overrides: Partial<RouterProbeDependencies> = {},
): RouterProbeDependencies {
  return {
    loadRouterPackage: vi.fn(() => ({ ExpoRoot: vi.fn() })),
    loadRootLayout: vi.fn(() => ({ default: vi.fn() })),
    loadTabsLayout: vi.fn(() => ({ default: vi.fn() })),
    loadAdminLayout: vi.fn(() => ({ default: vi.fn() })),
    loadIndexRoute: vi.fn(() => ({ default: vi.fn() })),
    loadQualifiedEntry: vi.fn(() => ({ App: vi.fn() })),
    requestRender: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

function controllerWith(
  probeDependencies: RouterProbeDependencies,
) {
  return createRouterIsolationController({
    dependencies: probeDependencies,
    beforeProbeExecution: () => Promise.resolve(),
  });
}

async function runThrough(
  controller: ReturnType<typeof createRouterIsolationController>,
  finalIndex: number,
): Promise<void> {
  for (let index = 0; index <= finalIndex; index += 1) {
    await controller.runProbe(index);
  }
}

describe("Phase-2 router isolation", () => {
  it("constructs the baseline without importing router or route modules", () => {
    const probeDependencies = dependencies();

    controllerWith(probeDependencies);

    expect(probeDependencies.loadRouterPackage).not.toHaveBeenCalled();
    expect(probeDependencies.loadRootLayout).not.toHaveBeenCalled();
    expect(probeDependencies.loadTabsLayout).not.toHaveBeenCalled();
    expect(probeDependencies.loadAdminLayout).not.toHaveBeenCalled();
    expect(probeDependencies.loadIndexRoute).not.toHaveBeenCalled();
    expect(probeDependencies.loadQualifiedEntry).not.toHaveBeenCalled();
    expect(probeDependencies.requestRender).not.toHaveBeenCalled();
  });

  it("runs each import only after its probe is manually activated", async () => {
    const probeDependencies = dependencies();
    const controller = controllerWith(probeDependencies);

    await controller.runProbe(0);

    expect(probeDependencies.loadRouterPackage).toHaveBeenCalledOnce();
    expect(probeDependencies.loadRootLayout).not.toHaveBeenCalled();
    expect(controller.getSnapshot().probes[0]?.status).toBe("pass");
    expect(controller.getSnapshot().probes[1]?.status).toBe("pending");
  });

  it("publishes RUNNING before entering the selected boundary", async () => {
    let releaseBoundary: (() => void) | undefined;
    const probeDependencies = dependencies();
    const controller = createRouterIsolationController({
      dependencies: probeDependencies,
      beforeProbeExecution: () =>
        new Promise<void>((resolve) => {
          releaseBoundary = resolve;
        }),
    });

    const running = controller.runProbe(0);

    expect(controller.getSnapshot().currentProbe).toBe(
      "Probe 1 — expo-router package",
    );
    expect(controller.getSnapshot().probes[0]?.status).toBe("running");
    expect(probeDependencies.loadRouterPackage).not.toHaveBeenCalled();

    releaseBoundary?.();
    await running;
    expect(probeDependencies.loadRouterPackage).toHaveBeenCalledOnce();
  });

  it("enforces probe order", async () => {
    const probeDependencies = dependencies();
    const controller = controllerWith(probeDependencies);

    await controller.runProbe(1);
    expect(probeDependencies.loadRootLayout).not.toHaveBeenCalled();

    await controller.runProbe(0);
    await controller.runProbe(2);
    expect(probeDependencies.requestRender).not.toHaveBeenCalled();

    await controller.runProbe(1);
    await controller.runProbe(2);
    expect(probeDependencies.requestRender).toHaveBeenCalledOnce();
  });

  it("displays a root layout import failure and does not advance", async () => {
    const probeDependencies = dependencies({
      loadRootLayout: vi.fn(() => {
        throw new TypeError("root layout import failed");
      }),
    });
    const controller = controllerWith(probeDependencies);

    await controller.runProbe(0);
    await controller.runProbe(1);
    await controller.runProbe(2);

    expect(controller.getSnapshot().probes[1]).toMatchObject({
      status: "fail",
      error: {
        name: "TypeError",
        message: "root layout import failed",
      },
    });
    expect(controller.getSnapshot().probes[2]?.status).toBe("pending");
    expect(probeDependencies.requestRender).not.toHaveBeenCalled();
  });

  it("captures a controlled render failure", async () => {
    const probeDependencies = dependencies({
      requestRender: vi.fn(() =>
        Promise.reject(new RangeError("RootLayout render failed")),
      ),
    });
    const controller = controllerWith(probeDependencies);

    await runThrough(controller, 2);

    expect(controller.getSnapshot().probes[2]).toMatchObject({
      status: "fail",
      error: {
        name: "RangeError",
        message: "RootLayout render failed",
      },
    });
  });

  it("forwards render-time errors through the React error boundary", () => {
    const onError = vi.fn();
    const error = new Error("render-time failure");
    const boundary = new RouterProbeErrorBoundary({
      children: null,
      onError,
    });

    expect(
      RouterProbeErrorBoundary.getDerivedStateFromError(error),
    ).toMatchObject({
      error: { name: "Error", message: "render-time failure" },
    });
    boundary.componentDidCatch(error, { componentStack: "" });
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("never auto-advances after a successful probe", async () => {
    const probeDependencies = dependencies();
    const controller = controllerWith(probeDependencies);

    await controller.runProbe(0);

    expect(controller.getSnapshot().probes[0]?.status).toBe("pass");
    expect(controller.getSnapshot().probes[1]?.status).toBe("pending");
    expect(probeDependencies.loadRootLayout).not.toHaveBeenCalled();
  });

  it("keeps the full router render probe manual and last", async () => {
    const probeDependencies = dependencies();
    const controller = controllerWith(probeDependencies);

    await runThrough(controller, 5);

    expect(probeDependencies.loadQualifiedEntry).not.toHaveBeenCalled();
    expect(controller.getSnapshot().probes[6]?.status).toBe("pending");

    await controller.runProbe(6);
    expect(probeDependencies.loadQualifiedEntry).toHaveBeenCalledOnce();
    expect(probeDependencies.requestRender).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: "qualified-entry" }),
    );
    expect(controller.getSnapshot().probes[6]?.status).toBe("pass");
  });

  it("preserves exact probe order in the event log", async () => {
    const controller = controllerWith(dependencies());
    await runThrough(controller, 6);

    const passes = controller
      .getSnapshot()
      .eventLog.filter((entry) => entry.startsWith("PASS"));
    expect(passes.map((entry) => entry.match(/Probe \d/u)?.[0])).toEqual([
      "Probe 1",
      "Probe 2",
      "Probe 3",
      "Probe 4",
      "Probe 5",
      "Probe 6",
      "Probe 7",
    ]);
  });

  it("records global ErrorUtils failures in the visible event log", () => {
    const previousHandler = vi.fn();
    let installedHandler:
      | ((error: unknown, isFatal?: boolean) => void)
      | undefined;
    const controller = controllerWith(dependencies());
    const restore = installVisibleGlobalErrorCapture(controller, {
      ErrorUtils: {
        getGlobalHandler: () => previousHandler,
        setGlobalHandler: (handler) => {
          installedHandler = handler;
        },
      },
    } as typeof globalThis & {
      ErrorUtils: {
        getGlobalHandler: () => typeof previousHandler;
        setGlobalHandler: (
          handler: (error: unknown, isFatal?: boolean) => void,
        ) => void;
      };
    });
    const error = new Error("global router failure");

    installedHandler?.(error, false);

    expect(controller.getSnapshot().eventLog.at(-1)).toContain(
      "GLOBAL NONFATAL — Error: global router failure",
    );
    expect(previousHandler).toHaveBeenCalledWith(error, false);
    restore();
  });
});
