import { Platform } from "react-native";
import {
  AppCheckTokenProvider,
  AppCheckTokenResult,
  AppCheckTokenProviderError,
} from "./appCheckTokenProvider.contract";

export * from "./appCheckTokenProvider.contract";

export class UnavailableAppCheckTokenProvider implements AppCheckTokenProvider {
  async getToken(_forceRefresh: boolean): Promise<AppCheckTokenResult> {
    throw new AppCheckTokenProviderError("app-check/provider-unavailable");
  }
}

/**
 * Lazy delegating provider that resolves to Web or Native App Check at runtime
 * based on the host platform, preventing top-level native imports.
 */
export class PlatformAppCheckTokenProvider implements AppCheckTokenProvider {
  private delegate: AppCheckTokenProvider | null = null;

  async getToken(forceRefresh: boolean): Promise<AppCheckTokenResult> {
    if (!this.delegate) {
      if (Platform.OS === "web") {
        const { WebAppCheckTokenProvider } = await import("./appCheckTokenProvider.web");
        this.delegate = new WebAppCheckTokenProvider();
      } else {
        const { NativeAppCheckTokenProvider } = await import("./appCheckTokenProvider.native");
        this.delegate = new NativeAppCheckTokenProvider();
      }
    }
    return this.delegate.getToken(forceRefresh);
  }
}
