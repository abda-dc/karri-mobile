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
    super(
      code === "app-check/provider-unavailable"
        ? "Device attestation is not available in this build."
        : "Device attestation did not return a valid token.",
    );
    this.name = "AppCheckTokenProviderError";
    this.code = code;
  }
}

export class UnavailableAppCheckTokenProvider implements AppCheckTokenProvider {
  async getToken(_forceRefresh: boolean): Promise<AppCheckTokenResult> {
    throw new AppCheckTokenProviderError("app-check/provider-unavailable");
  }
}
