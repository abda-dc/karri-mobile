import React, { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { registerRootComponent } from "expo";

declare const require: (moduleName: string) => unknown;

type ProbeStatus = "pending" | "running" | "pass" | "fail";

export interface IsolationErrorDetails {
  readonly name: string;
  readonly message: string;
  readonly stack: string;
}

export interface IsolationProbeState {
  readonly id: number;
  readonly label: string;
  readonly status: ProbeStatus;
  readonly detail?: string;
  readonly error?: IsolationErrorDetails;
}

export interface IsolationSnapshot {
  readonly currentProbe: string | null;
  readonly eventLog: readonly string[];
  readonly probes: readonly IsolationProbeState[];
}

interface NotificationSubscription {
  remove(): unknown;
}

interface NotificationsModule {
  addNotificationResponseReceivedListener(
    listener: (response: unknown) => void,
  ): NotificationSubscription | Promise<NotificationSubscription>;
}

interface FirebaseClientModule {
  readonly isFirebaseConfigured?: boolean;
  readonly missingFirebaseVariables?: readonly string[];
}

export interface IsolationProbeDependencies {
  loadAsyncStorage(): unknown;
  loadFirebaseAuthPersistence(): unknown;
  loadFirestoreMemoryCache(): unknown;
  loadFirebaseClient(): unknown;
  loadExpoNotifications(): unknown;
  loadMobileServices(): unknown;
}

export interface IsolationControllerOptions {
  readonly dependencies?: IsolationProbeDependencies;
  readonly beforeProbeExecution?: () => Promise<void>;
  readonly onChange?: (snapshot: IsolationSnapshot) => void;
}

export interface StartupIsolationController {
  getSnapshot(): IsolationSnapshot;
  runProbe(probeIndex: number): Promise<void>;
}

const maximumStackLines = 10;
const maximumStackLineLength = 240;
const maximumErrorValueLength = 800;

const probeLabels = [
  "Probe 1 — AsyncStorage module",
  "Probe 2 — Firebase Auth persistence",
  "Probe 3 — Firestore memory cache",
  "Probe 4 — Firebase client",
  "Probe 5 — Expo Notifications module",
  "Probe 6 — Notification listener",
  "Probe 7 — mobileServices module",
] as const;

const defaultProbeDependencies: IsolationProbeDependencies = {
  loadAsyncStorage: () => require("@react-native-async-storage/async-storage"),
  loadFirebaseAuthPersistence: () =>
    require("./src/infrastructure/firebase/authPersistence.native"),
  loadFirestoreMemoryCache: () =>
    require("./src/infrastructure/firebase/firestoreCache.native"),
  loadFirebaseClient: () =>
    require("./src/infrastructure/firebase/client"),
  loadExpoNotifications: () => require("expo-notifications"),
  loadMobileServices: () =>
    require("./src/presentation/services/mobileServices"),
};

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

function formatStack(stack: string | undefined): string {
  if (!stack) {
    return "<no JavaScript stack>";
  }

  return stack
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maximumStackLines)
    .map((line) => truncate(line, maximumStackLineLength))
    .join("\n");
}

export function normalizeIsolationError(error: unknown): IsolationErrorDetails {
  const normalized =
    error instanceof Error ? error : new Error(safelyStringify(error));

  return {
    name: truncate(normalized.name || "Error", maximumErrorValueLength),
    message: truncate(normalized.message, maximumErrorValueLength),
    stack: formatStack(normalized.stack),
  };
}

function initialProbeStates(): IsolationProbeState[] {
  return probeLabels.map((label, index) => ({
    id: index + 1,
    label,
    status: "pending",
  }));
}

function waitForDiagnosticPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(() => {
        setTimeout(resolve, 50);
      });
      return;
    }

    setTimeout(resolve, 0);
  });
}

export function createStartupIsolationController(
  options: IsolationControllerOptions = {},
): StartupIsolationController {
  const dependencies = options.dependencies ?? defaultProbeDependencies;
  const beforeProbeExecution =
    options.beforeProbeExecution ?? waitForDiagnosticPaint;
  let notificationsModule: NotificationsModule | null = null;
  let currentProbe: string | null = null;
  let eventLog = ["READY — No diagnostic probes have run."];
  let probes = initialProbeStates();

  const snapshot = (): IsolationSnapshot => ({
    currentProbe,
    eventLog: [...eventLog],
    probes: probes.map((probe) => ({ ...probe })),
  });

  const publish = (): void => {
    options.onChange?.(snapshot());
  };

  const updateProbe = (
    probeIndex: number,
    update: Omit<IsolationProbeState, "id" | "label">,
  ): void => {
    probes = probes.map((probe, index) =>
      index === probeIndex ? { ...probe, ...update } : probe,
    );
  };

  const executeProbe = async (probeIndex: number): Promise<string> => {
    switch (probeIndex) {
      case 0:
        dependencies.loadAsyncStorage();
        return "AsyncStorage module import completed.";
      case 1:
        dependencies.loadFirebaseAuthPersistence();
        return "Firebase Auth persistence import completed.";
      case 2:
        dependencies.loadFirestoreMemoryCache();
        return "Firestore memory cache import completed.";
      case 3: {
        const firebaseClient =
          dependencies.loadFirebaseClient() as FirebaseClientModule;
        const configured = firebaseClient.isFirebaseConfigured === true;
        const missing = firebaseClient.missingFirebaseVariables ?? [];
        const missingSummary =
          missing.length > 0 ? ` Missing: ${missing.join(", ")}.` : "";
        return `Firebase client import completed. Firebase configured: ${
          configured ? "YES" : "NO"
        }.${missingSummary}`;
      }
      case 4:
        notificationsModule =
          dependencies.loadExpoNotifications() as NotificationsModule;
        return "Expo Notifications module import completed. No permission requested.";
      case 5: {
        if (!notificationsModule) {
          throw new Error("Expo Notifications module is unavailable.");
        }

        const subscription = await Promise.resolve(
          notificationsModule.addNotificationResponseReceivedListener(
            () => undefined,
          ),
        );
        if (!subscription || typeof subscription.remove !== "function") {
          throw new Error("Notification listener returned no removable subscription.");
        }
        await Promise.resolve(subscription.remove());
        return "Notification listener registered and removed immediately.";
      }
      case 6:
        dependencies.loadMobileServices();
        return "mobileServices module import completed. Expo Router was not started.";
      default:
        throw new Error(`Unknown probe index: ${String(probeIndex)}`);
    }
  };

  return {
    getSnapshot: snapshot,
    async runProbe(probeIndex: number): Promise<void> {
      const probe = probes[probeIndex];
      if (!probe || probe.status !== "pending" || currentProbe) {
        return;
      }
      if (probeIndex > 0 && probes[probeIndex - 1]?.status !== "pass") {
        return;
      }

      currentProbe = probe.label;
      updateProbe(probeIndex, { status: "running" });
      eventLog = [...eventLog, `RUN — ${probe.label}`];
      publish();

      try {
        await beforeProbeExecution();
        const detail = await executeProbe(probeIndex);
        updateProbe(probeIndex, { status: "pass", detail });
        eventLog = [...eventLog, `PASS — ${probe.label}: ${detail}`];
      } catch (error) {
        const normalized = normalizeIsolationError(error);
        updateProbe(probeIndex, { status: "fail", error: normalized });
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

function statusLabel(status: ProbeStatus): string {
  return status.toUpperCase();
}

export function StartupIsolationApp(): React.ReactElement {
  const [, setRevision] = useState(0);
  const controllerRef = useRef<StartupIsolationController | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = createStartupIsolationController({
      onChange: () => setRevision((revision) => revision + 1),
    });
  }

  const controller = controllerRef.current;
  const state = controller.getSnapshot();

  return React.createElement(
    ScrollView,
    { contentContainerStyle: styles.screen },
    React.createElement(Text, { style: styles.title }, "Karri Startup Isolation"),
    React.createElement(
      Text,
      { style: styles.purpose },
      "Build purpose: isolate native JavaScript startup boundaries without loading Karri routes or services automatically.",
    ),
    React.createElement(
      View,
      { style: styles.baselineCard },
      React.createElement(
        Text,
        { style: styles.baselineText },
        "Baseline React Native screen loaded",
      ),
    ),
    React.createElement(
      View,
      { style: styles.currentCard },
      React.createElement(Text, { style: styles.sectionLabel }, "CURRENTLY RUNNING"),
      React.createElement(
        Text,
        { style: styles.currentText },
        state.currentProbe ?? "None — waiting for tester input",
      ),
    ),
    React.createElement(Text, { style: styles.heading }, "Manual probes"),
    ...state.probes.map((probe, index) => {
      const enabled =
        probe.status === "pending" &&
        state.currentProbe === null &&
        (index === 0 || state.probes[index - 1]?.status === "pass");

      return React.createElement(
        View,
        { key: probe.id, style: styles.probeCard },
        React.createElement(
          Pressable,
          {
            accessibilityRole: "button",
            disabled: !enabled,
            onPress: () => {
              void controller.runProbe(index);
            },
            style: [styles.button, !enabled && styles.buttonDisabled],
          },
          React.createElement(Text, { style: styles.buttonText }, probe.label),
        ),
        React.createElement(
          Text,
          { style: styles.status },
          `Status: ${statusLabel(probe.status)}`,
        ),
        probe.detail
          ? React.createElement(Text, { style: styles.detail }, probe.detail)
          : null,
        probe.error
          ? React.createElement(
              View,
              { style: styles.errorCard },
              React.createElement(Text, { style: styles.errorText }, `Error name: ${probe.error.name}`),
              React.createElement(Text, { style: styles.errorText }, `Error message: ${probe.error.message}`),
              React.createElement(Text, { style: styles.stackText }, `JavaScript stack:\n${probe.error.stack}`),
            )
          : null,
      );
    }),
    React.createElement(Text, { style: styles.heading }, "Event log"),
    React.createElement(
      View,
      { style: styles.logCard },
      ...state.eventLog.map((event, index) =>
        React.createElement(Text, { key: `${index}-${event}`, style: styles.logText }, event),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#0b1020",
    flexGrow: 1,
    paddingBottom: 48,
    paddingHorizontal: 18,
    paddingTop: 56,
  },
  title: { color: "#ffffff", fontSize: 28, fontWeight: "800" },
  purpose: { color: "#cbd5e1", fontSize: 15, lineHeight: 22, marginTop: 8 },
  baselineCard: {
    backgroundColor: "#064e3b",
    borderColor: "#34d399",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 18,
    padding: 16,
  },
  baselineText: { color: "#d1fae5", fontSize: 18, fontWeight: "700" },
  currentCard: {
    backgroundColor: "#172554",
    borderColor: "#60a5fa",
    borderRadius: 12,
    borderWidth: 2,
    marginTop: 14,
    padding: 16,
  },
  sectionLabel: { color: "#93c5fd", fontSize: 12, fontWeight: "800" },
  currentText: { color: "#ffffff", fontSize: 17, fontWeight: "700", marginTop: 6 },
  heading: { color: "#ffffff", fontSize: 20, fontWeight: "800", marginBottom: 10, marginTop: 24 },
  probeCard: { backgroundColor: "#1e293b", borderRadius: 12, marginBottom: 12, padding: 14 },
  button: { backgroundColor: "#2563eb", borderRadius: 9, paddingHorizontal: 12, paddingVertical: 13 },
  buttonDisabled: { backgroundColor: "#475569", opacity: 0.55 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  status: { color: "#e2e8f0", fontSize: 13, fontWeight: "700", marginTop: 10 },
  detail: { color: "#86efac", fontSize: 13, lineHeight: 19, marginTop: 6 },
  errorCard: { backgroundColor: "#450a0a", borderRadius: 8, marginTop: 8, padding: 10 },
  errorText: { color: "#fecaca", fontSize: 13, lineHeight: 19 },
  stackText: { color: "#fecaca", fontFamily: "monospace", fontSize: 11, lineHeight: 16, marginTop: 8 },
  logCard: { backgroundColor: "#020617", borderRadius: 12, padding: 14 },
  logText: { color: "#dbeafe", fontFamily: "monospace", fontSize: 12, lineHeight: 18, marginBottom: 6 },
});

registerRootComponent(StartupIsolationApp);
