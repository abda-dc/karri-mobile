import { ConfigContext, ExpoConfig } from "expo/config";

const { validateProductionFirebaseIdentity } = require("./src/infrastructure/firebase/productionFirebaseIdentity.js");

declare const require: any;
declare const process: any;
declare const __dirname: string;

const fs = require("fs");
const path = require("path");

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectRoot = __dirname;

  const isProductionEasBuild =
    process.env.EAS_BUILD === "true" &&
    process.env.EAS_BUILD_PROFILE === "production";
  const easBuildPlatform = process.env.EAS_BUILD_PLATFORM;

  const googleServicesJsonEnv = process.env.GOOGLE_SERVICES_JSON;
  const localGoogleServicesJson = path.join(projectRoot, "google-services.json");
  let googleServicesFile: string | undefined;

  if (googleServicesJsonEnv) {
    googleServicesFile = googleServicesJsonEnv;
  } else if (fs.existsSync(localGoogleServicesJson)) {
    googleServicesFile = "./google-services.json";
  }

  const googleServiceInfoPlistEnv = process.env.GOOGLE_SERVICE_INFO_PLIST;

  if (
    isProductionEasBuild &&
    easBuildPlatform !== "android" &&
    easBuildPlatform !== "ios"
  ) {
    throw new Error(
      "Production EAS builds require EAS_BUILD_PLATFORM to be android or ios.",
    );
  }

  if (
    isProductionEasBuild &&
    easBuildPlatform === "android" &&
    !googleServicesJsonEnv
  ) {
    throw new Error(
      "Production Android builds require GOOGLE_SERVICES_JSON.",
    );
  }

  if (
    isProductionEasBuild &&
    easBuildPlatform === "ios" &&
    !googleServiceInfoPlistEnv
  ) {
    throw new Error(
      "Production iOS builds require GOOGLE_SERVICE_INFO_PLIST.",
    );
  }

  if (isProductionEasBuild) {
    const platform = easBuildPlatform as "android" | "ios";
    const nativeConfigPath =
      platform === "android"
        ? googleServicesJsonEnv
        : googleServiceInfoPlistEnv;

    if (!nativeConfigPath || !fs.existsSync(nativeConfigPath)) {
      throw new Error(
        `Production ${platform} Firebase configuration file is unavailable.`,
      );
    }

    validateProductionFirebaseIdentity({
      platform,
      nativeConfigText: fs.readFileSync(nativeConfigPath, "utf8"),
      publicConfig: {
        apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
        authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        messagingSenderId:
          process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      },
    });
  }

  const localGoogleServiceInfoPlist = path.join(
    projectRoot,
    "GoogleService-Info.plist",
  );
  let googleServiceInfoPlistFile: string | undefined;

  if (googleServiceInfoPlistEnv) {
    googleServiceInfoPlistFile = googleServiceInfoPlistEnv;
  } else if (fs.existsSync(localGoogleServiceInfoPlist)) {
    googleServiceInfoPlistFile = "./GoogleService-Info.plist";
  }

  const androidConfig = { ...(config.android ?? {}) };
  const iosConfig = { ...(config.ios ?? {}) };

  delete androidConfig.googleServicesFile;
  delete iosConfig.googleServicesFile;

  const finalConfig: ExpoConfig = {
    ...config,
    name: config.name!,
    slug: config.slug!,
    android: androidConfig,
    ios: iosConfig,
  };

  if (googleServicesFile) {
    finalConfig.android = {
      ...androidConfig,
      googleServicesFile,
    };
  }

  if (googleServiceInfoPlistFile) {
    finalConfig.ios = {
      ...iosConfig,
      googleServicesFile: googleServiceInfoPlistFile,
    };
  }

  return finalConfig;
};
