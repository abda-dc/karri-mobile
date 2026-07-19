import { ConfigContext, ExpoConfig } from "expo/config";

declare const require: any;
declare const process: any;
declare const __dirname: string;

const fs = require("fs");
const path = require("path");

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectRoot = __dirname;

  // Resolve Android config path
  const googleServicesJsonEnv = process.env.GOOGLE_SERVICES_JSON;
  const localGoogleServicesJson = path.join(projectRoot, "google-services.json");
  let googleServicesFile: string | undefined = undefined;

  if (googleServicesJsonEnv) {
    googleServicesFile = googleServicesJsonEnv;
  } else if (fs.existsSync(localGoogleServicesJson)) {
    googleServicesFile = "./google-services.json";
  }

  // Resolve iOS config path
  const googleServiceInfoPlistEnv = process.env.GOOGLE_SERVICE_INFO_PLIST;
  const localGoogleServiceInfoPlist = path.join(projectRoot, "GoogleService-Info.plist");
  let googleServicesInfoPlistFile: string | undefined = undefined;

  if (googleServiceInfoPlistEnv) {
    googleServicesInfoPlistFile = googleServiceInfoPlistEnv;
  } else if (fs.existsSync(localGoogleServiceInfoPlist)) {
    googleServicesInfoPlistFile = "./GoogleService-Info.plist";
  }

  const finalConfig: ExpoConfig = {
    ...config,
    name: config.name!,
    slug: config.slug!,
  };

  if (googleServicesFile) {
    finalConfig.android = {
      ...config.android,
      googleServicesFile,
    };
  }

  if (googleServicesInfoPlistFile) {
    finalConfig.ios = {
      ...config.ios,
      googleServicesFile: googleServicesInfoPlistFile,
    };
  }

  return finalConfig;
};
