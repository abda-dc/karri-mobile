import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  Button: "Button",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));

vi.mock("expo", () => ({
  registerRootComponent: vi.fn(),
}));

import { StartupIsolationApp } from "./startupIsolationHarness";
import { RouterIsolationApp } from "./routerIsolationHarness";
import {
  getDiagnosticComponent,
  resolveDiagnosticPhase,
} from "./index.diagnostics";

declare const require: any;
declare const process: { cwd(): string; env: Record<string, string | undefined> };

const fs = require("fs");
const path = require("path");
const { resolveEntryPoint } = require("@expo/config/paths");
const {
  shouldActivateDiagnosticOverride,
  isExpoRouterEntryModule,
} = require("../../metro.config.js");

describe("production startup contract", () => {
  const projectRoot = process.cwd();
  const packageJsonPath = path.join(projectRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  it("defines expo-router/entry as the authoritative production main entry", () => {
    expect(packageJson.main).toBe("expo-router/entry");
  });

  it("does not target any diagnostic harness in package.json main", () => {
    const forbiddenTargets = [
      "RouterIsolationApp",
      "StartupIsolationApp",
      "index.diagnostics.ts",
      "./index.ts",
      "index.ts",
      "index.diagnostics",
      "routerIsolationHarness",
      "startupIsolationHarness",
      "startupDiagnostics",
    ];

    for (const forbidden of forbiddenTargets) {
      expect(packageJson.main).not.toContain(forbidden);
    }
  });

  it("resolves the production entry file directly to expo-router/entry.js", () => {
    const resolvedEntry = resolveEntryPoint(projectRoot, { platform: "android" });
    const normalizedPath = resolvedEntry.replace(/\\/g, "/");

    expect(normalizedPath).toMatch(/node_modules\/expo-router\/entry\.js$/);
    expect(normalizedPath).not.toContain("RouterIsolationApp");
    expect(normalizedPath).not.toContain("StartupIsolationApp");
    expect(normalizedPath).not.toContain("index.diagnostics");
    expect(normalizedPath).not.toContain("routerIsolationHarness");
    expect(normalizedPath).not.toContain("startupIsolationHarness");
  });

  it("ensures no obsolete root index.ts exists to create dual production entries", () => {
    const obsoleteIndexTs = path.join(projectRoot, "index.ts");
    const obsoleteIndexJs = path.join(projectRoot, "index.js");

    expect(fs.existsSync(obsoleteIndexTs)).toBe(false);
    expect(fs.existsSync(obsoleteIndexJs)).toBe(false);
  });

  it("preserves Phase 1 and Phase 2 diagnostic components via dedicated diagnostic harness", () => {
    expect(StartupIsolationApp).toBeTypeOf("function");
    expect(RouterIsolationApp).toBeTypeOf("function");

    // By default, diagnostic entry resolves to Phase 2 (the latest router harness)
    expect(resolveDiagnosticPhase()).toBe("phase2");
    expect(getDiagnosticComponent()).toBe(RouterIsolationApp);
  });

  it("isolates production Metro resolution from diagnostic override", () => {
    // 1. Absent KARRI_DIAGNOSTICS -> standard Expo Router resolution (no override)
    expect(shouldActivateDiagnosticOverride({})).toBe(false);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "" })).toBe(false);

    // 2. EAS_BUILD=true with KARRI_DIAGNOSTICS set -> diagnostic redirection is blocked
    expect(
      shouldActivateDiagnosticOverride({
        KARRI_DIAGNOSTICS: "phase1",
        EAS_BUILD: "true",
      }),
    ).toBe(false);
    expect(
      shouldActivateDiagnosticOverride({
        KARRI_DIAGNOSTICS: "phase2",
        EAS_BUILD: "true",
      }),
    ).toBe(false);

    // 3. Invalid KARRI_DIAGNOSTICS value -> diagnostic redirection is ignored
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "false" })).toBe(false);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "0" })).toBe(false);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "unknown_probe" })).toBe(false);

    // 4. Valid KARRI_DIAGNOSTICS -> activates diagnostic override
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "phase1" })).toBe(true);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "1" })).toBe(true);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "phase2" })).toBe(true);
    expect(shouldActivateDiagnosticOverride({ KARRI_DIAGNOSTICS: "2" })).toBe(true);

    // 5. Module matching only intercepts expo-router entry modules
    expect(isExpoRouterEntryModule("expo-router/entry")).toBe(true);
    expect(isExpoRouterEntryModule("expo-router/entry-classic")).toBe(true);
    expect(isExpoRouterEntryModule("node_modules/expo-router/entry.js")).toBe(true);
    expect(isExpoRouterEntryModule("node_modules/expo-router/entry-classic.js")).toBe(true);
    expect(isExpoRouterEntryModule("./app/index.tsx")).toBe(false);
    expect(isExpoRouterEntryModule("react-native")).toBe(false);
  });
});
