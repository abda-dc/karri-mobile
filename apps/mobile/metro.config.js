const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

function shouldActivateDiagnosticOverride(env = process.env) {
  const isEasBuild = env.EAS_BUILD === "true";
  const diagnosticHarness = env.KARRI_DIAGNOSTICS;
  const validDiagnosticPhases = new Set(["1", "phase1", "2", "phase2"]);
  const isDiagnosticRequested =
    typeof diagnosticHarness === "string" &&
    validDiagnosticPhases.has(diagnosticHarness.toLowerCase().trim());
  return isDiagnosticRequested && !isEasBuild;
}

function isExpoRouterEntryModule(moduleName) {
  return (
    moduleName === "expo-router/entry" ||
    moduleName === "expo-router/entry-classic" ||
    moduleName.endsWith("/expo-router/entry") ||
    moduleName.endsWith("/expo-router/entry-classic") ||
    moduleName.endsWith("/expo-router/entry.js") ||
    moduleName.endsWith("/expo-router/entry-classic.js") ||
    moduleName.endsWith("\\expo-router\\entry") ||
    moduleName.endsWith("\\expo-router\\entry-classic") ||
    moduleName.endsWith("\\expo-router\\entry.js") ||
    moduleName.endsWith("\\expo-router\\entry-classic.js")
  );
}

const config = getDefaultConfig(__dirname);

if (shouldActivateDiagnosticOverride(process.env)) {
  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (isExpoRouterEntryModule(moduleName)) {
      return {
        filePath: path.resolve(__dirname, "src/startup/index.diagnostics.ts"),
        type: "sourceFile",
      };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

module.exports = config;
module.exports.shouldActivateDiagnosticOverride = shouldActivateDiagnosticOverride;
module.exports.isExpoRouterEntryModule = isExpoRouterEntryModule;
