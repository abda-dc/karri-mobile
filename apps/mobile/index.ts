import { startWithStartupDiagnostics } from "./src/startup/startupDiagnostics";

declare const require: (moduleName: string) => unknown;

startWithStartupDiagnostics(() => require("expo-router/entry"));
