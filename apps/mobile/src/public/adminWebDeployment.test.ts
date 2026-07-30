import { describe, expect, it } from "vitest";

declare const require: (moduleName: string) => any;
declare const process: { cwd(): string };

const { readFileSync } = require("fs");
const { resolve } = require("path");

describe("admin web deployment configuration", () => {
  it("rewrites unknown nested routes to the Expo entry point without a 404 override", () => {
    const config = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "public/staticwebapp.config.json"),
        "utf8",
      ),
    );

    expect(config.navigationFallback.rewrite).toBe("/index.html");
    expect(config.responseOverrides).toBeUndefined();
  });

  it("does not publish administrator routes in the customer sitemap", () => {
    const sitemap = readFileSync(
      resolve(process.cwd(), "public/sitemap.xml"),
      "utf8",
    );

    expect(sitemap).not.toContain("admin-login");
    expect(sitemap).not.toContain("access-denied");
    expect(sitemap).not.toContain("(admin)");
  });
});
