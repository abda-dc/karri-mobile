import {
  ApplicationError,
  ApplicationErrorCode,
  type ApplicationErrorOptions,
} from "../../application/errors/ApplicationError";
import type { ApplicationErrorMapper } from "../../application/errors/ApplicationErrorService";

function getProviderCode(error: unknown): string | null {
  if (typeof error !== "object" || !error || !("code" in error)) {
    return null;
  }

  return String(error.code);
}

function createMappedError(
  error: unknown,
  providerCode: string | null,
  options: Omit<ApplicationErrorOptions, "originalError" | "providerCode">,
): ApplicationError {
  return new ApplicationError({
    ...options,
    originalError: error,
    providerCode: providerCode ?? undefined,
  });
}

function mapAuthError(error: unknown, providerCode: string): ApplicationError {
  switch (providerCode) {
    case "auth/network-request-failed":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Network,
        retryable: true,
        retryGuidance: "Check your connection and try again.",
        userMessage: "Karri could not start your session while the connection is unavailable.",
      });
    case "auth/too-many-requests":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.RateLimited,
        retryable: true,
        retryGuidance: "Wait a moment before trying again.",
        userMessage: "Karri has received too many sign-in attempts.",
      });
    case "auth/invalid-email":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Validation,
        retryable: false,
        retryGuidance: "Check the email address and try again.",
        userMessage: "That email address is not valid.",
      });
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Authentication,
        retryable: false,
        retryGuidance: "Check your sign-in details and try again.",
        userMessage: "Karri could not verify those sign-in details.",
      });
    case "auth/user-disabled":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Permission,
        retryable: false,
        retryGuidance: "Contact support before trying again.",
        userMessage: "This account cannot sign in right now.",
      });
    case "auth/requires-recent-login":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Authentication,
        retryable: false,
        retryGuidance: "Sign in again, then repeat the action.",
        userMessage: "Karri needs a fresh sign-in for this action.",
      });
    case "auth/email-already-in-use":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Conflict,
        retryable: false,
        retryGuidance: "Sign in with that account or use another email address.",
        userMessage: "An account already uses that email address.",
      });
    case "auth/weak-password":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Validation,
        retryable: false,
        retryGuidance: "Choose a stronger password and try again.",
        userMessage: "That password is not strong enough.",
      });
    case "auth/admin-restricted-operation":
    case "auth/operation-not-allowed":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Configuration,
        retryable: false,
        retryGuidance: "Ask the project administrator to enable this sign-in method.",
        userMessage: "This sign-in method is not available.",
      });
    default:
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Authentication,
        retryable: true,
        retryGuidance: "Try again. If the problem continues, restart the sign-in flow.",
        userMessage: "Karri could not start your session.",
      });
  }
}

function mapFirestoreError(error: unknown, providerCode: string): ApplicationError | null {
  const code = providerCode.startsWith("firestore/")
    ? providerCode.slice("firestore/".length)
    : providerCode;

  switch (code) {
    case "permission-denied":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Permission,
        retryable: false,
        retryGuidance: "Sign in with the correct account. If it continues, this action may not be allowed.",
        userMessage: "You do not have permission to perform that action.",
      });
    case "unauthenticated":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Authentication,
        retryable: false,
        retryGuidance: "Sign in again, then retry the action.",
        userMessage: "Your Karri session is no longer active.",
      });
    case "unavailable":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Network,
        retryable: true,
        retryGuidance: "Check your connection. Queued changes will resume automatically after reconnecting.",
        userMessage: "Karri cannot reach the service right now.",
      });
    case "deadline-exceeded":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Timeout,
        retryable: true,
        retryGuidance: "Check sync status before repeating the action.",
        userMessage: "Karri could not confirm the change in time.",
      });
    case "aborted":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Conflict,
        retryable: true,
        retryGuidance: "Review the latest state and try again.",
        userMessage: "This record changed while Karri was saving.",
      });
    case "already-exists":
    case "failed-precondition":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Conflict,
        retryable: false,
        retryGuidance: "Refresh the latest state before another attempt.",
        userMessage: "That action was already completed or is no longer available.",
      });
    case "not-found":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.NotFound,
        retryable: false,
        retryGuidance: "Refresh and choose an available item.",
        userMessage: "That record is no longer available.",
      });
    case "resource-exhausted":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.RateLimited,
        retryable: true,
        retryGuidance: "Wait a moment and try again.",
        userMessage: "Karri is receiving too many requests right now.",
      });
    case "cancelled":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Cancelled,
        retryable: true,
        retryGuidance: "Try the action again when you are ready.",
        userMessage: "The operation was interrupted before it finished.",
      });
    case "invalid-argument":
    case "out-of-range":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Validation,
        retryable: false,
        retryGuidance: "Review the information and try again.",
        userMessage: "Karri could not accept part of that request.",
      });
    case "internal":
    case "unknown":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Temporary,
        retryable: true,
        retryGuidance: "Try again after checking the latest sync state.",
        userMessage: "The service could not complete that action right now.",
      });
    case "data-loss":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Unknown,
        retryable: false,
        retryGuidance: "Refresh the latest data before taking another action.",
        userMessage: "Karri could not read a reliable response.",
      });
    case "unimplemented":
      return createMappedError(error, providerCode, {
        code: ApplicationErrorCode.Configuration,
        retryable: false,
        retryGuidance: "Update Karri or contact support before trying again.",
        userMessage: "This action is not available in the current environment.",
      });
    default:
      return providerCode.startsWith("firestore/")
        ? createMappedError(error, providerCode, {
            code: ApplicationErrorCode.Unknown,
            retryable: true,
            retryGuidance: "Try again after checking the latest sync state.",
            userMessage: "Karri could not complete that data operation.",
          })
        : null;
  }
}

export class FirebaseErrorMapper implements ApplicationErrorMapper {
  map(error: unknown): ApplicationError | null {
    if (error instanceof Error && error.name === "FirebaseConfigurationError") {
      return createMappedError(error, null, {
        code: ApplicationErrorCode.Configuration,
        retryable: false,
        retryGuidance: "Add the documented mobile environment values and restart Karri.",
        userMessage: "Karri is not configured for this environment.",
      });
    }

    const providerCode = getProviderCode(error);
    if (!providerCode) {
      return null;
    }

    if (providerCode.startsWith("auth/")) {
      return mapAuthError(error, providerCode);
    }

    return mapFirestoreError(error, providerCode);
  }
}
