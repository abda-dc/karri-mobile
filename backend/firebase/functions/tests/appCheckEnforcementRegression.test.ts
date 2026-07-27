import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  onBookingAccepted,
  placeAdministrativeHold,
  registerPushToken,
  releaseAdministrativeHold,
  submitSafetyReview,
  unregisterPushToken,
} from "../src/index.js";

const sourcePath = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const callableFunctions = {
  submitSafetyReview,
  placeAdministrativeHold,
  releaseAdministrativeHold,
  registerPushToken,
  unregisterPushToken,
} as const;

describe("Patch 4A1 App Check enforcement guard", () => {
  it("keeps all five callables on the shared disabled-enforcement options", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(/const callableRuntimeOptions = \{[\s\S]*?enforceAppCheck:\s*false,[\s\S]*?\}\s+as const;/u);
    expect(Object.keys(callableFunctions)).toHaveLength(5);

    for (const [functionName, callableFunction] of Object.entries(callableFunctions)) {
      expect(callableFunction.__endpoint.callableTrigger).toBeDefined();
      expect(callableFunction.__endpoint.eventTrigger).toBeUndefined();
      expect(source).toMatch(new RegExp(`export const ${functionName} = onCall\\(callableRuntimeOptions,`));
    }

    expect(onBookingAccepted.__endpoint.callableTrigger).toBeUndefined();
    expect(onBookingAccepted.__endpoint.eventTrigger).toBeDefined();
  });
});
