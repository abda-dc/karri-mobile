export interface AppCheckTokenResult {
  readonly token: string;
}

export interface AppCheckTokenProvider {
  getToken(forceRefresh: boolean): Promise<AppCheckTokenResult>;
}

export type AppCheckTokenProviderErrorCode =
  | "app-check/provider-unavailable"
  | "app-check/invalid-token";

export class AppCheckTokenProviderError extends Error {
  readonly code: AppCheckTokenProviderErrorCode;

  constructor(code: AppCheckTokenProviderErrorCode) {
    super(code);
    this.name = "AppCheckTokenProviderError";
    this.code = code;
  }
}

/**
 * Validates an App Check token string according to strict security requirements.
 * Rejects empty strings, leading/trailing whitespace, embedded whitespace, and control characters.
 */
export function validateAppCheckToken(token: unknown): string {
  if (typeof token !== "string") {
    throw new AppCheckTokenProviderError("app-check/invalid-token");
  }
  if (token.length === 0) {
    throw new AppCheckTokenProviderError("app-check/invalid-token");
  }
  if (token.trim() !== token) {
    throw new AppCheckTokenProviderError("app-check/invalid-token");
  }
  if (/\s/.test(token)) {
    throw new AppCheckTokenProviderError("app-check/invalid-token");
  }
  // Check for control characters (U+0000 to U+001F, and U+007F)
  if (/[\u0000-\u001f\u007f]/.test(token)) {
    throw new AppCheckTokenProviderError("app-check/invalid-token");
  }
  return token;
}
