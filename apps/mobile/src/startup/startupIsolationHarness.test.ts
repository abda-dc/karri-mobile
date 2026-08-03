import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const entryMocks = vi.hoisted(() => ({
  registeredComponent: undefined as React.ComponentType | undefined,
  riskyModuleLoads: {
    asyncStorage: 0,
    firebaseAuthPersistence: 0,
    firebaseClient: 0,
    firestoreCache: 0,
    mobileServices: 0,
    notifications: 0,
    router: 0,
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof React>("react");
  const mocked = {
    ...actual,
    useRef: <T,>(initialValue: T) => ({ current: initialValue }),
    useState: <T,>(initialValue: T) => [initialValue, vi.fn()] as const,
  };

  return { ...mocked, default: mocked };
});

vi.mock("expo", () => ({
  registerRootComponent: vi.fn((component: React.ComponentType) => {
    entryMocks.registeredComponent = component;
  }),
}));

vi.mock("react-native", async () => {
  const actualReact = await vi.importActual<typeof React>("react");
  const element = (tag: string) =>
    ({ children, disabled }: { children?: React.ReactNode; disabled?: boolean }) =>
      actualReact.createElement(tag, { disabled }, children);

  return {
    Pressable: element("button"),
    ScrollView: element("main"),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: element("span"),
    View: element("section"),
  };
});

vi.mock("@react-native-async-storage/async-storage", () => {
  entryMocks.riskyModuleLoads.asyncStorage += 1;
  return { default: {} };
});
vi.mock("../infrastructure/firebase/authPersistence.native", () => {
  entryMocks.riskyModuleLoads.firebaseAuthPersistence += 1;
  return {};
});
vi.mock("../infrastructure/firebase/firestoreCache.native", () => {
  entryMocks.riskyModuleLoads.firestoreCache += 1;
  return {};
});
vi.mock("../infrastructure/firebase/client", () => {
  entryMocks.riskyModuleLoads.firebaseClient += 1;
  return {};
});
vi.mock("expo-notifications", () => {
  entryMocks.riskyModuleLoads.notifications += 1;
  return {};
});
vi.mock("../presentation/services/mobileServices", () => {
  entryMocks.riskyModuleLoads.mobileServices += 1;
  return {};
});
vi.mock("expo-router/entry", () => {
  entryMocks.riskyModuleLoads.router += 1;
  return {};
});

import {
  createStartupIsolationController,
  type IsolationProbeDependencies,
} from "../../index";

function passingDependencies(
  overrides: Partial<IsolationProbeDependencies> = {},
): IsolationProbeDependencies {
  return {
    loadAsyncStorage: vi.fn(() => ({})),
    loadFirebaseAuthPersistence: vi.fn(() => ({})),
    loadFirestoreMemoryCache: vi.fn(() => ({})),
    loadFirebaseClient: vi.fn(() => ({
      isFirebaseConfigured: true,
      missingFirebaseVariables: [],
    })),
    loadExpoNotifications: vi.fn(() => ({
      addNotificationResponseReceivedListener: vi.fn(() => ({
        remove: vi.fn(),
      })),
    })),
    loadMobileServices: vi.fn(() => ({})),
    ...overrides,
  };
}

async function passThroughProbe(
  controller: ReturnType<typeof createStartupIsolationController>,
  lastProbeIndex: number,
): Promise<void> {
  for (let index = 0; index <= lastProbeIndex; index += 1) {
    await controller.runProbe(index);
  }
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("on-device startup isolation harness", () => {
  it("registers and initially renders without loading any risky module", () => {
    expect(entryMocks.registeredComponent).toBeTypeOf("function");

    const rootElement = (
      entryMocks.registeredComponent as () => React.ReactElement
    )();
    const renderedText = JSON.stringify(rootElement);

    expect(renderedText).toContain("Karri Startup Isolation");
    expect(renderedText).toContain("Baseline React Native screen loaded");
    expect(entryMocks.riskyModuleLoads).toEqual({
      asyncStorage: 0,
      firebaseAuthPersistence: 0,
      firebaseClient: 0,
      firestoreCache: 0,
      mobileServices: 0,
      notifications: 0,
      router: 0,
    });
  });

  it("does not execute probes until explicitly activated", () => {
    const dependencies = passingDependencies();

    createStartupIsolationController({ dependencies });

    expect(dependencies.loadAsyncStorage).not.toHaveBeenCalled();
    expect(dependencies.loadFirebaseAuthPersistence).not.toHaveBeenCalled();
    expect(dependencies.loadFirestoreMemoryCache).not.toHaveBeenCalled();
    expect(dependencies.loadFirebaseClient).not.toHaveBeenCalled();
    expect(dependencies.loadExpoNotifications).not.toHaveBeenCalled();
    expect(dependencies.loadMobileServices).not.toHaveBeenCalled();
  });

  it("publishes the running probe before entering its risky boundary", async () => {
    let releasePaintBoundary: (() => void) | undefined;
    const beforeProbeExecution = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releasePaintBoundary = resolve;
        }),
    );
    const dependencies = passingDependencies();
    const changes: string[] = [];
    const controller = createStartupIsolationController({
      beforeProbeExecution,
      dependencies,
      onChange: (state) => {
        changes.push(state.currentProbe ?? "none");
      },
    });

    const runningProbe = controller.runProbe(0);

    expect(changes).toEqual(["Probe 1 — AsyncStorage module"]);
    expect(controller.getSnapshot().probes[0]?.status).toBe("running");
    expect(dependencies.loadAsyncStorage).not.toHaveBeenCalled();

    releasePaintBoundary?.();
    await runningProbe;

    expect(dependencies.loadAsyncStorage).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().probes[0]?.status).toBe("pass");
  });

  it("blocks every later probe until the preceding probe passes", async () => {
    const dependencies = passingDependencies();
    const controller = createStartupIsolationController({ dependencies });

    await controller.runProbe(1);
    expect(dependencies.loadFirebaseAuthPersistence).not.toHaveBeenCalled();

    await controller.runProbe(0);
    await controller.runProbe(2);
    expect(dependencies.loadFirestoreMemoryCache).not.toHaveBeenCalled();

    await controller.runProbe(1);
    await controller.runProbe(2);
    expect(dependencies.loadFirestoreMemoryCache).toHaveBeenCalledOnce();
  });

  it("marks successful probes PASS and reports Firebase configuration", async () => {
    const controller = createStartupIsolationController({
      dependencies: passingDependencies(),
    });

    await passThroughProbe(controller, 3);

    const state = controller.getSnapshot();
    expect(state.probes.slice(0, 4).map((probe) => probe.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
    expect(state.probes[3]?.detail).toContain("Firebase configured: YES");
  });

  it("displays synchronous require failure name, message, and truncated stack", async () => {
    const failure = new TypeError("AsyncStorage native boundary failed");
    failure.stack = [
      "TypeError: AsyncStorage native boundary failed",
      ...Array.from({ length: 15 }, (_, index) => `at frame${index} (probe.ts:${index + 1}:1)`),
    ].join("\n");
    const controller = createStartupIsolationController({
      dependencies: passingDependencies({
        loadAsyncStorage: vi.fn(() => {
          throw failure;
        }),
      }),
    });

    await controller.runProbe(0);

    const error = controller.getSnapshot().probes[0]?.error;
    expect(error).toMatchObject({
      name: "TypeError",
      message: "AsyncStorage native boundary failed",
    });
    expect(error?.stack).toContain("frame0");
    expect(error?.stack).not.toContain("frame10");
  });

  it("displays asynchronous notification-listener failures", async () => {
    const controller = createStartupIsolationController({
      dependencies: passingDependencies({
        loadExpoNotifications: vi.fn(() => ({
          addNotificationResponseReceivedListener: vi.fn(() =>
            Promise.reject(new RangeError("listener promise rejected")),
          ),
        })),
      }),
    });
    await passThroughProbe(controller, 5);

    expect(controller.getSnapshot().probes[5]).toMatchObject({
      status: "fail",
      error: {
        name: "RangeError",
        message: "listener promise rejected",
      },
    });
  });

  it("removes a successful notification subscription immediately", async () => {
    const remove = vi.fn(() => Promise.resolve());
    const addListener = vi.fn(() => Promise.resolve({ remove }));
    const controller = createStartupIsolationController({
      dependencies: passingDependencies({
        loadExpoNotifications: vi.fn(() => ({
          addNotificationResponseReceivedListener: addListener,
        })),
      }),
    });
    await passThroughProbe(controller, 5);

    expect(addListener).toHaveBeenCalledOnce();
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(remove).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().probes[5]?.status).toBe("pass");
  });

  it("preserves probe order in the diagnostic event log", async () => {
    const controller = createStartupIsolationController({
      dependencies: passingDependencies(),
    });
    await passThroughProbe(controller, 6);

    const completedEvents = controller
      .getSnapshot()
      .eventLog.filter((event) => event.startsWith("PASS"));
    expect(completedEvents.map((event) => event.match(/Probe \d/u)?.[0])).toEqual([
      "Probe 1",
      "Probe 2",
      "Probe 3",
      "Probe 4",
      "Probe 5",
      "Probe 6",
      "Probe 7",
    ]);
  });

  it("does not launch another probe after a failure", async () => {
    const loadFirebaseAuthPersistence = vi.fn(() => ({}));
    const controller = createStartupIsolationController({
      dependencies: passingDependencies({
        loadAsyncStorage: vi.fn(() => {
          throw "plain failure";
        }),
        loadFirebaseAuthPersistence,
      }),
    });

    await controller.runProbe(0);
    await controller.runProbe(1);

    expect(controller.getSnapshot().probes[0]).toMatchObject({
      status: "fail",
      error: { name: "Error", message: "plain failure" },
    });
    expect(controller.getSnapshot().probes[1]?.status).toBe("pending");
    expect(loadFirebaseAuthPersistence).not.toHaveBeenCalled();
  });
});
