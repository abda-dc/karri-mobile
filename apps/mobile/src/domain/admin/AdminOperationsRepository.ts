import type { AuthorizationRole } from "../authorization/roles";
import type { AdminOperationsOverview } from "./AdminOperationsOverview";

export interface AdminOperationsRepository {
  getOverview(role: AuthorizationRole): Promise<AdminOperationsOverview>;
}
