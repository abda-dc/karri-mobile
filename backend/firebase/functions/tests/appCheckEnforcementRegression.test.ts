import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourcePath = fileURLToPath(new URL("../src/index.ts", import.meta.url));

describe("Patch 4A1 App Check enforcement guard", () => {
  it("keeps all three privileged callables on the shared disabled-enforcement options", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(/const callableRuntimeOptions = \{[\s\S]*?enforceAppCheck:\s*false,[\s\S]*?\}\s+as const;/u);
    for (const functionName of ["placeAdministrativeHold", "releaseAdministrativeHold", "submitSafetyReview"]) {
      expect(source).toMatch(new RegExp(`export const ${functionName} = onCall\\(callableRuntimeOptions,`));
    }
  });
});
