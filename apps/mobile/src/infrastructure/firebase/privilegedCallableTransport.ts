import type { User as FirebaseUser } from "firebase/auth";
import type { AppCheckTokenProvider } from "./appCheckTokenProvider.contract";
import { AppCheckTokenProviderError } from "./appCheckTokenProvider.contract";
import { getFirebaseServices } from "./client";

const CALLABLE_REGION = "us-east1";
const CREDENTIAL_ERROR_CODES = new Set(["UNAUTHENTICATED"]);
const NON_RETRYABLE_CALLABLE_CODES = new Set([
  "PERMISSION_DENIED",
  "INVALID_ARGUMENT",
  "FAILED_PRECONDITION",
  "ALREADY_EXISTS",
  "NOT_FOUND",
  "OUT_OF_RANGE",
]);

export type PrivilegedCallableName =
  | "placeAdministrativeHold"
  | "releaseAdministrativeHold"
  | "submitSafetyReview"
  | "registerPushToken"
  | "unregisterPushToken";

export interface RegisterPushTokenPayload {
  readonly deviceId: string;
  readonly platform: "android" | "ios";
  readonly provider: "expo";
  readonly token: string;
  readonly registeredAt: string;
}

export interface RegisterPushTokenResult {
  readonly success: boolean;
  readonly deviceId: string;
  readonly status: "registered";
  readonly alreadyExisted: boolean;
}

export interface UnregisterPushTokenPayload {
  readonly deviceId: string;
}

export interface UnregisterPushTokenResult {
  readonly success: boolean;
  readonly deviceId: string;
  readonly status: "unregistered";
  readonly alreadyInactive: boolean;
}

export interface PlaceAdministrativeHoldPayload {
  readonly shipmentId: string;
  readonly reasonCode: string;
  readonly note?: string;
  readonly idempotencyKey: string;
}

export interface ReleaseAdministrativeHoldPayload {
  readonly holdId: string;
  readonly reasonCode: string;
  readonly note?: string;
  readonly idempotencyKey: string;
}

export interface SubmitSafetyReviewPayload {
  readonly shipmentId: string;
  readonly decision: "approved" | "rejected" | "needs_more_information";
  readonly reasonCode: string;
  readonly note?: string;
  readonly declarationVersionReviewed: string;
  readonly packageContentVersionReviewed: number;
  readonly idempotencyKey: string;
}

export interface AdministrativeHoldResult {
  readonly success: boolean;
  readonly holdId: string;
  readonly alreadyExisted: boolean;
}

export interface SafetyReviewResult {
  readonly success: boolean;
  readonly reviewId: string;
  readonly alreadyExisted: boolean;
}

interface CallableAuthUser {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

export interface CallableAuthProvider {
  getCurrentUser(): CallableAuthUser | null;
}

export type PrivilegedCallableErrorCode =
  | "callable/signed-out"
  | "callable/invalid-auth-token"
  | "callable/invalid-app-check-token"
  | "callable/network"
  | "callable/invalid-response"
  | "callable/http-error"
  | `callable/${string}`;

export interface PrivilegedCallableErrorOptions {
  readonly code: PrivilegedCallableErrorCode;
  readonly callableCode?: string;
  readonly details?: unknown;
  readonly httpStatus?: number;
  readonly retryable: boolean;
  readonly safeMessage: string;
  readonly requiresCredentialRefresh?: boolean;
}

export class PrivilegedCallableError extends Error {
  readonly code: PrivilegedCallableErrorCode;
  readonly callableCode: string | null;
  readonly details: unknown;
  readonly httpStatus: number | null;
  readonly retryable: boolean;
  readonly requiresCredentialRefresh: boolean;

  constructor(options: PrivilegedCallableErrorOptions) {
    super(options.safeMessage);
    this.name = "PrivilegedCallableError";
    this.code = options.code;
    this.callableCode = options.callableCode ?? null;
    this.details = options.details;
    this.httpStatus = options.httpStatus ?? null;
    this.retryable = options.retryable;
    this.requiresCredentialRefresh = options.requiresCredentialRefresh ?? false;
  }
}

export interface PrivilegedCallableTransportOptions {
  readonly appCheckTokenProvider: AppCheckTokenProvider;
  readonly authProvider?: CallableAuthProvider;
  readonly fetchImplementation?: typeof fetch;
  readonly projectId?: string;
  readonly allowDevelopmentBypass?: boolean;
}

interface CallableErrorEnvelope {
  error: {
    details?: unknown;
    message?: unknown;
    status?: unknown;
  };
}

function firebaseJsAuthProvider(): CallableAuthProvider {
  return {
    getCurrentUser: (): FirebaseUser | null => getFirebaseServices().auth.currentUser,
  };
}

function isNonEmptyToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

function redactKnownTokens(value: string, tokens: ReadonlyArray<string>): string {
  return tokens.reduce((message, token) => token ? message.split(token).join("[REDACTED]") : message, value);
}

function redactKnownTokensFromValue(value: unknown, tokens: ReadonlyArray<string>): unknown {
  if (typeof value === "string") {
    return redactKnownTokens(value, tokens);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactKnownTokensFromValue(item, tokens));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        redactKnownTokens(key, tokens),
        redactKnownTokensFromValue(item, tokens),
      ]),
    );
  }
  return value;
}

function callableCodeToProviderCode(code: string): PrivilegedCallableErrorCode {
  return `callable/${code.toLowerCase().replaceAll("_", "-")}`;
}

export class PrivilegedCallableTransport {
  private readonly appCheckTokenProvider: AppCheckTokenProvider;
  private readonly authProvider: CallableAuthProvider;
  private readonly fetchImplementation: typeof fetch;
  private readonly projectId: string;
  private readonly allowDevelopmentBypass: boolean;

  constructor(options: PrivilegedCallableTransportOptions) {
    this.appCheckTokenProvider = options.appCheckTokenProvider;
    this.authProvider = options.authProvider ?? firebaseJsAuthProvider();
    this.fetchImplementation = options.fetchImplementation ?? fetch;
    this.projectId = options.projectId ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "";
    this.allowDevelopmentBypass = options.allowDevelopmentBypass ?? false;
  }

  placeAdministrativeHold(payload: PlaceAdministrativeHoldPayload): Promise<AdministrativeHoldResult> {
    return this.invoke("placeAdministrativeHold", payload);
  }

  releaseAdministrativeHold(payload: ReleaseAdministrativeHoldPayload): Promise<AdministrativeHoldResult> {
    return this.invoke("releaseAdministrativeHold", payload);
  }

  submitSafetyReview(payload: SubmitSafetyReviewPayload): Promise<SafetyReviewResult> {
    return this.invoke("submitSafetyReview", payload);
  }

  registerPushToken(payload: RegisterPushTokenPayload): Promise<RegisterPushTokenResult> {
    return this.invoke("registerPushToken", payload, [payload.token]);
  }

  unregisterPushToken(payload: UnregisterPushTokenPayload): Promise<UnregisterPushTokenResult> {
    return this.invoke("unregisterPushToken", payload);
  }

  private async invoke<TResult>(
    functionName: PrivilegedCallableName,
    payload: object,
    sensitiveTokens: string[] = [],
  ): Promise<TResult> {
    const user = this.authProvider.getCurrentUser();
    if (!user) {
      throw new PrivilegedCallableError({
        code: "callable/signed-out",
        retryable: false,
        safeMessage: "Sign in before performing this action.",
      });
    }

    let forceRefresh = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const credentials = await this.getCredentials(user, forceRefresh);
      try {
        return await this.send<TResult>(functionName, payload, credentials, sensitiveTokens);
      } catch (error) {
        if (attempt === 0 && error instanceof PrivilegedCallableError && error.requiresCredentialRefresh) {
          forceRefresh = true;
          continue;
        }
        throw error;
      }
    }

    throw new PrivilegedCallableError({
      code: "callable/invalid-response",
      retryable: false,
      safeMessage: "The service did not return a usable response.",
    });
  }

  private async getCredentials(user: CallableAuthUser, forceRefresh: boolean): Promise<{ authToken: string; appCheckToken: string | null }> {
    const isDev = typeof __DEV__ !== "undefined" && __DEV__ === true;
    const bypassAppCheck = isDev && this.allowDevelopmentBypass;

    if (bypassAppCheck) {
      console.warn("[DEVELOPMENT ONLY] App Check validation is bypassed by local environment configuration.");
      const authToken = await user.getIdToken(forceRefresh);
      if (!isNonEmptyToken(authToken)) {
        throw new PrivilegedCallableError({
          code: "callable/invalid-auth-token",
          retryable: false,
          safeMessage: "The current sign-in session did not return a valid credential.",
        });
      }
      return { authToken, appCheckToken: null };
    }

    const [authToken, appCheckResult] = await Promise.all([
      user.getIdToken(forceRefresh),
      this.appCheckTokenProvider.getToken(forceRefresh),
    ]);

    if (!isNonEmptyToken(authToken)) {
      throw new PrivilegedCallableError({
        code: "callable/invalid-auth-token",
        retryable: false,
        safeMessage: "The current sign-in session did not return a valid credential.",
      });
    }
    if (!isNonEmptyToken(appCheckResult?.token)) {
      throw new AppCheckTokenProviderError("app-check/invalid-token");
    }

    return { authToken, appCheckToken: appCheckResult.token };
  }

  private async send<TResult>(
    functionName: PrivilegedCallableName,
    payload: object,
    credentials: { authToken: string; appCheckToken: string | null },
    sensitiveTokens: string[] = [],
  ): Promise<TResult> {
    const url = `https://${CALLABLE_REGION}-${this.projectId}.cloudfunctions.net/${functionName}`;
    let response: Response;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${credentials.authToken}`,
      "Content-Type": "application/json",
    };
    if (credentials.appCheckToken) {
      headers["X-Firebase-AppCheck"] = credentials.appCheckToken;
    }

    try {
      response = await this.fetchImplementation(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ data: payload }),
      });
    } catch {
      throw new PrivilegedCallableError({
        code: "callable/network",
        retryable: true,
        safeMessage: "Karri could not reach the command service.",
      });
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new PrivilegedCallableError({
        code: response.ok ? "callable/invalid-response" : "callable/http-error",
        httpStatus: response.status,
        retryable: response.status >= 500,
        safeMessage: "The command service returned an unreadable response.",
      });
    }

    if (body && typeof body === "object" && "error" in body) {
      const envelope = body as CallableErrorEnvelope;
      const rawStatus = typeof envelope.error?.status === "string" ? envelope.error.status : "UNKNOWN";
      const knownTokens = [credentials.authToken, credentials.appCheckToken, ...sensitiveTokens].filter((t): t is string => !!t);
      const safeStatus = knownTokens.some(t => rawStatus.includes(t)) ? "[REDACTED]" : redactKnownTokens(rawStatus, knownTokens);
      const serverMessageRaw = typeof envelope.error?.message === "string" ? envelope.error.message : "The command was rejected.";
      const safeMessage = redactKnownTokens(serverMessageRaw, knownTokens);
      throw new PrivilegedCallableError({
        code: callableCodeToProviderCode(safeStatus),
        callableCode: safeStatus,
        details: redactKnownTokensFromValue(envelope.error?.details, knownTokens),
        httpStatus: response.status,
        retryable: !NON_RETRYABLE_CALLABLE_CODES.has(rawStatus) && (CREDENTIAL_ERROR_CODES.has(rawStatus) || response.status >= 500),
        safeMessage,
        requiresCredentialRefresh: CREDENTIAL_ERROR_CODES.has(rawStatus),
      });
    }

    if (!response.ok) {
      throw new PrivilegedCallableError({
        code: "callable/http-error",
        httpStatus: response.status,
        retryable: response.status >= 500,
        safeMessage: "The command service rejected the request.",
      });
    }

    if (!body || typeof body !== "object" || !("result" in body)) {
      throw new PrivilegedCallableError({
        code: "callable/invalid-response",
        httpStatus: response.status,
        retryable: false,
        safeMessage: "The command service returned an invalid response.",
      });
    }

    return (body as { result: TResult }).result;
  }
}
