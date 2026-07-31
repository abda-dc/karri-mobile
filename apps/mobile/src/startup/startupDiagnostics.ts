import { Alert } from "react-native";

export type StartupErrorHandler = (
  error: unknown,
  isFatal?: boolean,
) => void;

export interface StartupErrorUtils {
  getGlobalHandler?: () => StartupErrorHandler | undefined;
  setGlobalHandler(handler: StartupErrorHandler): void;
}

interface StartupRuntime {
  readonly ErrorUtils?: StartupErrorUtils;
}

interface StartupDiagnosticDependencies {
  readonly presentAlert: typeof Alert.alert;
  readonly terminate: (error: unknown) => void;
}

type StartupPhase = "entry-require" | "global-handler";

interface FatalStartupFailure {
  delegated: boolean;
  readonly error: unknown;
  readonly isFatal: boolean | undefined;
}

const maximumStackLines = 10;
const maximumStackLineLength = 240;
const maximumDisplayValueLength = 500;

function safelyStringify(value: unknown): string {
  try {
    return String(value);
  } catch {
    return "<unprintable thrown value>";
  }
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(safelyStringify(error));
}

function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength - 1)}…`;
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

function reportStartupError(
  phase: StartupPhase,
  error: unknown,
  isFatal: boolean,
): Error {
  const normalized = normalizeError(error);

  console.error(
    `[KARRI_STARTUP_ERROR] phase=${phase} fatal=${String(isFatal)} ` +
      `name=${normalized.name} message=${normalized.message}\n` +
      `${normalized.stack ?? "<no stack>"}`,
  );

  return normalized;
}

function formatAlertMessage(
  phase: StartupPhase,
  normalized: Error,
): string {
  return [
    `Phase: ${phase}`,
    `Error name: ${truncate(normalized.name, maximumDisplayValueLength)}`,
    `Error message: ${truncate(normalized.message, maximumDisplayValueLength)}`,
    "JavaScript stack:",
    formatStack(normalized.stack),
    "Take screenshots of this message before closing it.",
  ].join("\n\n");
}

function defaultTerminate(error: unknown): never {
  throw error;
}

export function startWithStartupDiagnostics(
  loadExpoRouterEntry: () => unknown,
  runtime: StartupRuntime = globalThis as StartupRuntime,
  dependencyOverrides: Partial<StartupDiagnosticDependencies> = {},
): void {
  const errorUtils = runtime.ErrorUtils;
  const previousHandler = errorUtils?.getGlobalHandler?.();
  const presentAlert = dependencyOverrides.presentAlert ?? Alert.alert;
  const terminate = dependencyOverrides.terminate ?? defaultTerminate;
  let activeFatalFailure: FatalStartupFailure | null = null;
  let delegatingFatalFailure = false;
  let presentingFatalAlert = false;

  const delegateFatalFailure = (failure: FatalStartupFailure): void => {
    if (failure.delegated) {
      return;
    }

    failure.delegated = true;
    if (!previousHandler) {
      terminate(failure.error);
      return;
    }

    delegatingFatalFailure = true;
    try {
      previousHandler(failure.error, failure.isFatal);
    } finally {
      delegatingFatalFailure = false;
    }
  };

  const presentFatalFailure = (
    phase: StartupPhase,
    error: unknown,
    isFatal: boolean | undefined,
  ): void => {
    const normalized = reportStartupError(phase, error, isFatal ?? true);

    if (activeFatalFailure) {
      return;
    }

    const failure: FatalStartupFailure = {
      delegated: false,
      error,
      isFatal,
    };
    activeFatalFailure = failure;
    presentingFatalAlert = true;

    try {
      presentAlert(
        "Karri Startup Diagnostic",
        formatAlertMessage(phase, normalized),
        [
          {
            text: "Close App",
            onPress: () => delegateFatalFailure(failure),
          },
        ],
        { cancelable: false },
      );
    } catch (alertError) {
      const normalizedAlertError = normalizeError(alertError);
      console.error(
        `[KARRI_STARTUP_ERROR] phase=${phase} fatal=true ` +
          `alert-presentation-failed name=${normalizedAlertError.name} ` +
          `message=${normalizedAlertError.message}`,
      );
      delegateFatalFailure(failure);
    } finally {
      presentingFatalAlert = false;
    }
  };

  if (errorUtils) {
    errorUtils.setGlobalHandler((error, isFatal) => {
      if (isFatal === false) {
        reportStartupError("global-handler", error, false);
        previousHandler?.(error, isFatal);
        return;
      }

      if (delegatingFatalFailure || presentingFatalAlert) {
        const failure = activeFatalFailure ?? {
          delegated: false,
          error,
          isFatal,
        };
        reportStartupError("global-handler", error, true);
        delegateFatalFailure(failure);
        return;
      }

      presentFatalFailure("global-handler", error, isFatal);
    });
  }

  try {
    loadExpoRouterEntry();
  } catch (error) {
    presentFatalFailure("entry-require", error, true);
  }
}
