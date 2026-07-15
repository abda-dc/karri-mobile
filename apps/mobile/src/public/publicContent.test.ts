import { describe, expect, it } from "vitest";
import { publicPages, publicRouteLabels } from "./publicContent";

const requestedRoutes = [
  "/about", "/trust-center", "/privacy-policy", "/terms-of-service", "/safety",
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
});
