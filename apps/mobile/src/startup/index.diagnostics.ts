import type { ComponentType } from "react";
import { registerRootComponent } from "expo";
import { StartupIsolationApp } from "./startupIsolationHarness";
import { RouterIsolationApp } from "./routerIsolationHarness";

export type DiagnosticPhase = "phase1" | "phase2";

export function resolveDiagnosticPhase(): DiagnosticPhase {
  const rawPhase =
    process.env.EXPO_PUBLIC_KARRI_DIAGNOSTIC_PHASE ||
    process.env.KARRI_DIAGNOSTIC_PHASE ||
    process.env.KARRI_DIAGNOSTICS;

  const envPhase =
    typeof rawPhase === "string" ? rawPhase.toLowerCase().trim() : "";

  if (envPhase === "1" || envPhase === "phase1") {
    return "phase1";
  }
  return "phase2";
}

export function getDiagnosticComponent(): ComponentType {
  const phase = resolveDiagnosticPhase();
  return phase === "phase1" ? StartupIsolationApp : RouterIsolationApp;
}

registerRootComponent(getDiagnosticComponent());
