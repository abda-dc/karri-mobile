#!/usr/bin/env node
const { spawn } = require("child_process");
const path = require("path");

const phase = process.argv[2] === "phase1" ? "phase1" : "phase2";
const extraArgs = process.argv.slice(3);

const env = {
  ...process.env,
  KARRI_DIAGNOSTICS: phase,
  EXPO_PUBLIC_KARRI_DIAGNOSTIC_PHASE: phase,
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCmd, ["expo", "start", "-c", ...extraArgs], {
  cwd: path.resolve(__dirname, ".."),
  env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
