import { initializeAppCheck, getToken, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getFirebaseServices } from "./client";
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

let webAppCheckInstance: any = null;

function getOrInitializeWebAppCheck(): any {
  if (webAppCheckInstance) {
    return webAppCheckInstance;
  }

  const siteKey = process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_SITE_KEY;
  if (!siteKey || siteKey.trim().length === 0 || siteKey.startsWith("your-")) {
    throw new AppCheckTokenProviderError("app-check/provider-unavailable");
  }

  try {
    const { app } = getFirebaseServices();
    const provider = new ReCaptchaEnterpriseProvider(siteKey);
    webAppCheckInstance = initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    return webAppCheckInstance;
  } catch (err: any) {
    throw new AppCheckTokenProviderError("app-check/provider-unavailable");
  }
}

export class WebAppCheckTokenProvider implements AppCheckTokenProvider {
  async getToken(forceRefresh: boolean): Promise<AppCheckTokenResult> {
    try {
      const appCheck = getOrInitializeWebAppCheck();
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
  private delegate = new WebAppCheckTokenProvider();

  async getToken(forceRefresh: boolean): Promise<AppCheckTokenResult> {
    return this.delegate.getToken(forceRefresh);
  }
}
