import {
  AppCheckTokenProvider,
  AppCheckTokenResult,
  AppCheckTokenProviderError,
  validateAppCheckToken,
} from "./appCheckTokenProvider.contract";

export * from "./appCheckTokenProvider.contract";

export class UnavailableAppCheckTokenProvider implements AppCheckTokenProvider {
  async getToken(_forceRefresh: boolean): Promise<AppCheckTokenResult> {
    throw new AppCheckTokenProviderError("app-check/provider-unavailable");
  }
}

let initPromise: Promise<{ appCheck: any; getToken: any }> | null = null;
let appCheckInstance: any = null;
let nativeGetToken: any = null;

async function getOrInitializeNativeAppCheck(): Promise<{ appCheck: any; getToken: any }> {
  if (appCheckInstance && nativeGetToken) {
    return { appCheck: appCheckInstance, getToken: nativeGetToken };
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        // Lazily import native Firebase packages to prevent crashes in Expo Go
        const { getApp } = await import("@react-native-firebase/app");
        const { initializeAppCheck, ReactNativeFirebaseAppCheckProvider, getToken } = await import("@react-native-firebase/app-check");

        const providerOptions = {
          android: {
            provider: (__DEV__ ? "debug" : "playIntegrity") as "debug" | "playIntegrity",
          },
          apple: {
            provider: (__DEV__ ? "debug" : "appAttestWithDeviceCheckFallback") as "debug" | "appAttestWithDeviceCheckFallback",
          },
        };

        const provider = new ReactNativeFirebaseAppCheckProvider(providerOptions);
        const app = getApp();

        appCheckInstance = await initializeAppCheck(app, {
          provider,
          isTokenAutoRefreshEnabled: true,
        });
        nativeGetToken = getToken;

        return { appCheck: appCheckInstance, getToken: nativeGetToken };
      } catch (err: any) {
        initPromise = null; // Allow retry if initialization failed
        throw new AppCheckTokenProviderError("app-check/provider-unavailable");
      }
    })();
  }

  return initPromise;
}

export class NativeAppCheckTokenProvider implements AppCheckTokenProvider {
  async getToken(forceRefresh: boolean): Promise<AppCheckTokenResult> {
    try {
      const { appCheck, getToken } = await getOrInitializeNativeAppCheck();
      const result = await getToken(appCheck, forceRefresh);

      if (!result || typeof result.token !== "string") {
        throw new AppCheckTokenProviderError("app-check/invalid-token");
      }

      const validatedToken = validateAppCheckToken(result.token);
      return { token: validatedToken };
    } catch (err: any) {
      if (err instanceof AppCheckTokenProviderError) {
        throw err;
      }
      throw new AppCheckTokenProviderError("app-check/invalid-token");
    }
  }
}

export class PlatformAppCheckTokenProvider implements AppCheckTokenProvider {
  private delegate = new NativeAppCheckTokenProvider();

  async getToken(forceRefresh: boolean): Promise<AppCheckTokenResult> {
    return this.delegate.getToken(forceRefresh);
  }
}
