import { LegalPageLayout, PublicContentPage } from "./PublicComponents";
import { PublicRoute, publicPages } from "./publicContent";

const legalRoutes = new Set<PublicRoute>(["/privacy-policy", "/terms-of-service", "/safety", "/prohibited-items", "/community-guidelines"]);

export function PublicRoutePage({ route }: { route: Exclude<PublicRoute, "/"> }) {
  const page = publicPages[route];
  return legalRoutes.has(route) ? <LegalPageLayout page={page} /> : <PublicContentPage page={page} />;
}
