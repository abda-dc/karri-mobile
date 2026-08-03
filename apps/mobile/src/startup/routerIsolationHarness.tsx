import React, {
  Component,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

declare const require: (moduleName: string) => unknown;

type ProbeStatus = "pending" | "running" | "pass" | "fail";

export interface RouterProbeError {
  readonly name: string;
  readonly message: string;
  readonly stack: string;
}

export interface RouterProbeState {
  readonly id: number;
  readonly label: string;
  readonly status: ProbeStatus;
  readonly detail?: string;
  readonly error?: RouterProbeError;
}

export interface RouterIsolationSnapshot {
  readonly currentProbe: string | null;
  readonly eventLog: readonly string[];
  readonly probes: readonly RouterProbeState[];
}

interface RouteModule {
  readonly default?: ComponentType;
}

interface RouterPackage {
  readonly ExpoRoot?: ComponentType<{ context: RouterRequireContext }>;
}

interface QualifiedEntryModule {
  readonly App?: ComponentType;
}

interface RouterRequireContext {
  (key: string): RouteModule;
  keys(): string[];
  resolve(key: string): string;
  id: string;
}

export interface RouterRenderRequest {
  readonly kind: "root-layout" | "qualified-entry";
  readonly component: ComponentType;
  readonly routerPackage?: RouterPackage;
}

export interface RouterProbeDependencies {
  loadRouterPackage(): unknown;
  loadRootLayout(): unknown;
  loadTabsLayout(): unknown;
  loadAdminLayout(): unknown;
  loadIndexRoute(): unknown;
  loadQualifiedEntry(): unknown;
  requestRender(request: RouterRenderRequest): Promise<void>;
}

export interface RouterIsolationController {
  getSnapshot(): RouterIsolationSnapshot;
  recordGlobalError(error: unknown, isFatal?: boolean): void;
  runProbe(index: number): Promise<void>;
}

export interface RouterIsolationControllerOptions {
  readonly beforeProbeExecution?: () => Promise<void>;
  readonly dependencies: RouterProbeDependencies;
  readonly onChange?: (snapshot: RouterIsolationSnapshot) => void;
}

const probeLabels = [
  "Probe 1 — expo-router package",
  "Probe 2 — app/_layout.tsx import",
  "Probe 3 — controlled RootLayout render",
  "Probe 4 — app/(tabs)/_layout.tsx import",
  "Probe 5 — app/(admin)/_layout.tsx import",
  "Probe 6 — app/index.tsx import",
  "Probe 7 — full Expo Router App render",
] as const;

const maximumStackLines = 12;
const maximumStackLineLength = 240;
const renderObservationMilliseconds = 2_000;

function safelyStringify(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "<unprintable thrown value>";
  }
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength - 3)}...`;
}

export function normalizeRouterProbeError(error: unknown): RouterProbeError {
  const normalized =
    error instanceof Error ? error : new Error(safelyStringify(error));
  const stack = normalized.stack
    ? normalized.stack
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, maximumStackLines)
        .map((line) => truncate(line, maximumStackLineLength))
        .join("\n")
    : "<no JavaScript stack>";

  return {
    name: truncate(normalized.name || "Error", 800),
    message: truncate(normalized.message, 800),
    stack,
  };
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => setTimeout(resolve, 50));
      return;
    }
    setTimeout(resolve, 0);
  });
}

export function createRouterIsolationController(
  options: RouterIsolationControllerOptions,
): RouterIsolationController {
  const beforeProbeExecution = options.beforeProbeExecution ?? waitForPaint;
  const dependencies = options.dependencies;
  let routerPackage: RouterPackage | null = null;
  let rootLayout: RouteModule | null = null;
  let currentProbe: string | null = null;
  let eventLog = [
    "READY — Phase-1 dependency probes passed on physical devices.",
    "READY — No router or Karri layout module has been imported.",
  ];
  let probes: RouterProbeState[] = probeLabels.map((label, index) => ({
    id: index + 1,
    label,
    status: "pending",
  }));

  const snapshot = (): RouterIsolationSnapshot => ({
    currentProbe,
    eventLog: [...eventLog],
    probes: probes.map((probe) => ({ ...probe })),
  });

  const publish = (): void => options.onChange?.(snapshot());

  const updateProbe = (
    index: number,
    update: Omit<RouterProbeState, "id" | "label">,
  ): void => {
    probes = probes.map((probe, probeIndex) =>
      probeIndex === index ? { ...probe, ...update } : probe,
    );
  };

  const executeProbe = async (index: number): Promise<string> => {
    switch (index) {
      case 0:
        routerPackage = dependencies.loadRouterPackage() as RouterPackage;
        if (typeof routerPackage.ExpoRoot !== "function") {
          throw new Error("expo-router did not export ExpoRoot.");
        }
        return "expo-router package import completed without entry.";
      case 1:
        rootLayout = dependencies.loadRootLayout() as RouteModule;
        if (typeof rootLayout.default !== "function") {
          throw new Error("Root layout has no default component export.");
        }
        return "app/_layout.tsx import completed.";
      case 2:
        if (!routerPackage || !rootLayout?.default) {
          throw new Error("RootLayout prerequisites are unavailable.");
        }
        await dependencies.requestRender({
          kind: "root-layout",
          component: rootLayout.default,
          routerPackage,
        });
        return "RootLayout committed inside a synthetic ExpoRoot and remained alive for 2 seconds.";
      case 3:
        dependencies.loadTabsLayout();
        return "app/(tabs)/_layout.tsx import completed.";
      case 4:
        dependencies.loadAdminLayout();
        return "app/(admin)/_layout.tsx import completed.";
      case 5:
        dependencies.loadIndexRoute();
        return "app/index.tsx import completed.";
      case 6: {
        const entry =
          dependencies.loadQualifiedEntry() as QualifiedEntryModule;
        if (typeof entry.App !== "function") {
          throw new Error("Expo Router qualified entry has no App export.");
        }
        await dependencies.requestRender({
          kind: "qualified-entry",
          component: entry.App,
        });
        return "Full Expo Router App committed and remained alive for 2 seconds.";
      }
      default:
        throw new Error(`Unknown router probe: ${String(index)}`);
    }
  };

  return {
    getSnapshot: snapshot,
    recordGlobalError(error, isFatal) {
      const normalized = normalizeRouterProbeError(error);
      eventLog = [
        ...eventLog,
        `GLOBAL ${isFatal === false ? "NONFATAL" : "FATAL"} — ` +
          `${normalized.name}: ${normalized.message}\n${normalized.stack}`,
      ];
      publish();
    },
    async runProbe(index) {
      const probe = probes[index];
      if (!probe || probe.status !== "pending" || currentProbe) {
        return;
      }
      if (index > 0 && probes[index - 1]?.status !== "pass") {
        return;
      }

      currentProbe = probe.label;
      updateProbe(index, { status: "running" });
      eventLog = [...eventLog, `RUN — ${probe.label}`];
      publish();

      try {
        await beforeProbeExecution();
        const detail = await executeProbe(index);
        updateProbe(index, { status: "pass", detail });
        eventLog = [...eventLog, `PASS — ${probe.label}: ${detail}`];
      } catch (error) {
        const normalized = normalizeRouterProbeError(error);
        updateProbe(index, { status: "fail", error: normalized });
        eventLog = [
          ...eventLog,
          `FAIL — ${probe.label}: ${normalized.name}: ${normalized.message}`,
        ];
      } finally {
        currentProbe = null;
        publish();
      }
    },
  };
}

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly onError: (error: unknown) => void;
}

interface ErrorBoundaryState {
  readonly error: RouterProbeError | null;
}

export class RouterProbeErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: normalizeRouterProbeError(error) };
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>
            Render error: {this.state.error.name}
          </Text>
          <Text style={styles.errorText}>{this.state.error.message}</Text>
          <Text style={styles.stackText}>{this.state.error.stack}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

function ProbeCommitSignal({
  onCommit,
}: {
  readonly onCommit: () => void;
}): null {
  useEffect(() => {
    const timer = setTimeout(onCommit, renderObservationMilliseconds);
    return () => clearTimeout(timer);
  }, [onCommit]);
  return null;
}

function createSyntheticContext(
  RootLayout: ComponentType,
  onCommit: () => void,
): RouterRequireContext {
  const rootModule: RouteModule = {
    default: function ControlledRootLayout(): ReactElement {
      return (
        <>
          <RootLayout />
          <ProbeCommitSignal onCommit={onCommit} />
        </>
      );
    },
  };
  const leafModule: RouteModule = {
    default: () => <Text>Controlled router leaf loaded</Text>,
  };
  const context = ((key: string): RouteModule => {
    if (key === "./_layout.tsx") return rootModule;
    if (key === "./index.tsx") return leafModule;
    throw new Error(`Unexpected synthetic route: ${key}`);
  }) as RouterRequireContext;
  context.keys = () => ["./_layout.tsx", "./index.tsx"];
  context.resolve = (key) => key;
  context.id = "karri-phase-2-root-layout";
  return context;
}

interface RuntimeErrorUtils {
  getGlobalHandler?():
    | ((error: unknown, isFatal?: boolean) => void)
    | undefined;
  setGlobalHandler(
    handler: (error: unknown, isFatal?: boolean) => void,
  ): void;
}

export function installVisibleGlobalErrorCapture(
  controller: RouterIsolationController,
  runtime: typeof globalThis & { ErrorUtils?: RuntimeErrorUtils } = globalThis,
): () => void {
  const errorUtils = runtime.ErrorUtils;
  if (!errorUtils) return () => undefined;

  const previous = errorUtils.getGlobalHandler?.();
  const handler = (error: unknown, isFatal?: boolean): void => {
    controller.recordGlobalError(error, isFatal);
    const delegate = (): void => {
      if (previous) {
        previous(error, isFatal);
      } else if (isFatal !== false) {
        throw error instanceof Error
          ? error
          : new Error(safelyStringify(error));
      }
    };
    if (isFatal === false) delegate();
    else setTimeout(delegate, 1_000);
  };
  errorUtils.setGlobalHandler(handler);
  return () => {
    if (previous) errorUtils.setGlobalHandler(previous);
  };
}

const defaultLoads = {
  loadRouterPackage: () => require("expo-router"),
  loadRootLayout: () => require("../../app/_layout"),
  loadTabsLayout: () => require("../../app/(tabs)/_layout"),
  loadAdminLayout: () => require("../../app/(admin)/_layout"),
  loadIndexRoute: () => require("../../app/index"),
  loadQualifiedEntry: () =>
    require("expo-router/build/qualified-entry"),
};

export function RouterIsolationApp(): ReactElement {
  const [, setRevision] = useState(0);
  const [renderRequest, setRenderRequest] = useState<
    (RouterRenderRequest & { id: number }) | null
  >(null);
  const pendingRender = useRef<{
    reject: (error: unknown) => void;
    resolve: () => void;
  } | null>(null);
  const renderId = useRef(0);
  const controllerRef = useRef<RouterIsolationController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createRouterIsolationController({
      dependencies: {
        ...defaultLoads,
        requestRender: (request) =>
          new Promise<void>((resolve, reject) => {
            pendingRender.current = { reject, resolve };
            renderId.current += 1;
            setRenderRequest({ ...request, id: renderId.current });
          }),
      },
      onChange: () => setRevision((value) => value + 1),
    });
  }

  const controller = controllerRef.current;
  const snapshot = controller.getSnapshot();

  useEffect(
    () => installVisibleGlobalErrorCapture(controller),
    [controller],
  );

  const renderProbe = (): ReactNode => {
    if (!renderRequest) return null;
    const Target = renderRequest.component;
    const onCommit = (): void => {
      pendingRender.current?.resolve();
      pendingRender.current = null;
    };
    const onError = (error: unknown): void => {
      pendingRender.current?.reject(error);
      pendingRender.current = null;
    };

    let content: ReactNode;
    if (renderRequest.kind === "root-layout") {
      const ExpoRoot = renderRequest.routerPackage?.ExpoRoot;
      if (!ExpoRoot) {
        content = (
          <ProbeRenderFailure
            error={new Error("ExpoRoot unavailable.")}
          />
        );
      } else {
        const context = createSyntheticContext(Target, onCommit);
        content = <ExpoRoot context={context} />;
      }
    } else {
      content = (
        <>
          <Target />
          <ProbeCommitSignal onCommit={onCommit} />
        </>
      );
    }

    return (
      <RouterProbeErrorBoundary
        key={renderRequest.id}
        onError={onError}
      >
        {content}
      </RouterProbeErrorBoundary>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>Karri Startup Isolation — Phase 2</Text>
      <Text style={styles.body}>
        Expo Router, layouts, route construction, and first render.
      </Text>
      <View style={styles.baselineCard}>
        <Text style={styles.passText}>Baseline React Native screen loaded</Text>
        <Text style={styles.passText}>
          Phase-1 dependency probes: 7/7 PASS on physical devices
        </Text>
      </View>
      <View style={styles.runningCard}>
        <Text style={styles.label}>CURRENTLY RUNNING</Text>
        <Text style={styles.runningText}>
          {snapshot.currentProbe ?? "None — waiting for tester input"}
        </Text>
      </View>

      {snapshot.probes.map((probe, index) => {
        const enabled =
          probe.status === "pending" &&
          snapshot.currentProbe === null &&
          (index === 0 || snapshot.probes[index - 1]?.status === "pass");
        return (
          <View key={probe.id} style={styles.probeCard}>
            <Button
              disabled={!enabled}
              onPress={() => void controller.runProbe(index)}
              title={probe.label}
            />
            <Text style={styles.body}>
              Status: {probe.status.toUpperCase()}
            </Text>
            {probe.detail ? (
              <Text style={styles.passText}>{probe.detail}</Text>
            ) : null}
            {probe.error ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>
                  Error name: {probe.error.name}
                </Text>
                <Text style={styles.errorText}>
                  Error message: {probe.error.message}
                </Text>
                <Text style={styles.stackText}>
                  JavaScript stack:{"\n"}
                  {probe.error.stack}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={styles.heading}>Controlled render target</Text>
      <View style={styles.renderTarget}>{renderProbe()}</View>
      <Text style={styles.heading}>Event log</Text>
      <View style={styles.logCard}>
        {snapshot.eventLog.map((entry, index) => (
          <Text key={`${index}-${entry}`} style={styles.logText}>
            {entry}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

function ProbeRenderFailure({ error }: { readonly error: Error }): never {
  throw error;
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#0b1020",
    flexGrow: 1,
    padding: 18,
    paddingTop: 56,
  },
  title: { color: "#ffffff", fontSize: 26, fontWeight: "800" },
  heading: { color: "#ffffff", fontSize: 19, fontWeight: "800", marginTop: 20 },
  body: { color: "#cbd5e1", lineHeight: 20, marginTop: 8 },
  label: { color: "#93c5fd", fontSize: 12, fontWeight: "800" },
  baselineCard: { backgroundColor: "#064e3b", borderRadius: 10, marginTop: 16, padding: 14 },
  runningCard: { backgroundColor: "#172554", borderRadius: 10, marginVertical: 14, padding: 14 },
  runningText: { color: "#ffffff", fontSize: 17, fontWeight: "700", marginTop: 6 },
  probeCard: { backgroundColor: "#1e293b", borderRadius: 10, marginBottom: 10, padding: 12 },
  passText: { color: "#86efac", lineHeight: 20, marginTop: 6 },
  errorCard: { backgroundColor: "#450a0a", borderRadius: 8, marginTop: 8, padding: 10 },
  errorText: { color: "#fecaca", lineHeight: 19 },
  stackText: { color: "#fecaca", fontFamily: "monospace", fontSize: 11, marginTop: 8 },
  renderTarget: { backgroundColor: "#ffffff", borderRadius: 10, minHeight: 420, overflow: "hidden", marginTop: 8 },
  logCard: { backgroundColor: "#020617", borderRadius: 10, marginTop: 8, padding: 12 },
  logText: { color: "#dbeafe", fontFamily: "monospace", fontSize: 11, lineHeight: 17, marginBottom: 5 },
});
