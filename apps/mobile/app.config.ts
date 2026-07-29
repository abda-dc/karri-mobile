import { ConfigContext, ExpoConfig } from "expo/config";

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
