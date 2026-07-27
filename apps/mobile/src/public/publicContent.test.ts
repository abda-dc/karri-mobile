import { describe, expect, it } from "vitest";
import {
  FAQ_PREVIEW,
  HOW_KARRI_WORKS,
  KARRI_MOBILE_DESCRIPTION,
  KARRI_MOBILE_PATH,
  KARRI_MOBILE_REQUIRED_LINKS,
  KARRI_MOBILE_TITLE,
  SAFETY_REMINDERS,
} from "./karriMobileContent";
import { publicPages, publicRouteLabels } from "./publicContent";

const requestedRoutes = [
  "/about", "/trust-center", "/privacy-policy", "/delete-account", "/terms-of-service", "/safety",
  "/prohibited-items", "/community-guidelines", "/faq", "/release-notes", "/support",
  "/contact", "/press", "/careers",
] as const;

describe("public website content", () => {
  it("defines every requested public route with complete metadata", () => {
    expect(Object.keys(publicPages).sort()).toEqual([...requestedRoutes].sort());
    for (const route of requestedRoutes) {
      const page = publicPages[route];
      expect(page.path).toBe(route);
      expect(page.title.length).toBeGreaterThan(3);
      expect(page.description.length).toBeGreaterThan(40);
      expect(page.heading.length).toBeGreaterThan(3);
      expect(page.sections.length).toBeGreaterThan(1);
    }
  });

  it("keeps all related links inside the public route registry", () => {
    for (const page of Object.values(publicPages)) {
      for (const route of page.related) {
        expect(publicRouteLabels[route]).toBeTruthy();
        if (route !== "/") expect(publicPages[route]).toBeTruthy();
      }
    }
  });

  it("uses unique section anchors within each document", () => {
    for (const page of Object.values(publicPages)) {
      const ids = page.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("publishes complete Google Play account-deletion guidance", () => {
    const page = publicPages["/delete-account"];
    const copy = JSON.stringify(page);

    expect(copy).toContain("hello@aptopsagency.com");
    expect(copy).toContain("account owner");
    expect(copy).toContain("within 30 days");
    expect(copy).toContain("fraud");
    expect(copy).toContain("audit");
    expect(page.related).toContain("/privacy-policy");
    expect(page.related).toContain("/support");
  });

  it("defines the Karri Mobile marketing route and required MVP guidance", () => {
    expect(KARRI_MOBILE_PATH).toBe("/karri-mobile");
    expect(KARRI_MOBILE_TITLE).toBe(
      "Karri Mobile | Community Shipping for Senders and Travelers",
    );
    expect(KARRI_MOBILE_DESCRIPTION).toContain("custody expectations");
    expect(HOW_KARRI_WORKS).toHaveLength(5);
    expect(SAFETY_REMINDERS.join(" ")).toContain("customs requirements");
    expect(FAQ_PREVIEW.find((item) => item.question === "Does Karri process payments?")?.answer)
      .toBe("No. Karri does not currently process payments.");
    expect(FAQ_PREVIEW.find((item) => item.question === "Does Karri guarantee delivery?")?.answer)
      .toContain("does not guarantee delivery");
    expect(KARRI_MOBILE_REQUIRED_LINKS).toEqual([
      "/about",
      "/safety",
      "/trust-center",
      "/faq",
      "/support",
      "/contact",
      "/privacy-policy",
      "/terms-of-service",
      "/delete-account",
    ]);
  });
});
