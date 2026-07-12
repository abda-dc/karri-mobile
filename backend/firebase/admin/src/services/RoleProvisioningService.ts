import type { FirebaseAdminGateway } from "../gateways/FirebaseAdminGateway.js";

export const SUPPORTED_ROLES = [
  "user",
  "support",
  "moderator",
  "operations_admin",
  "safety_admin",
  "super_admin",
] as const;

export type AuthorizationRole = typeof SUPPORTED_ROLES[number];

export class RoleProvisioningService {
  constructor(private readonly gateway: FirebaseAdminGateway) {}

  private validateUid(uid: string): void {
    if (!uid || typeof uid !== "string" || uid.trim().length === 0) {
      throw new Error("Invalid UID: UID cannot be empty.");
    }
    if (uid.length > 128) {
      throw new Error("Invalid UID: Firebase UIDs must be 128 characters or fewer.");
    }
  }

  private validateRole(role: string): AuthorizationRole {
    if (!SUPPORTED_ROLES.includes(role as any)) {
      throw new Error(`Invalid role: '${role}'. Supported roles are: ${SUPPORTED_ROLES.join(", ")}`);
    }
    return role as AuthorizationRole;
  }

  async getCustomClaims(uid: string): Promise<{ [key: string]: any }> {
    this.validateUid(uid);
    const user = await this.gateway.getUser(uid);
    return user.customClaims || {};
  }

  async setRole(uid: string, roleInput: string): Promise<{ claims: { [key: string]: any }; changed: boolean }> {
    this.validateUid(uid);
    const role = this.validateRole(roleInput);

    const user = await this.gateway.getUser(uid);
    const existingClaims = user.customClaims || {};
    const currentRole = existingClaims.role || "user";

    // 1. Detect no-op role assignment to prevent unnecessary token revocations
    if (currentRole === role) {
      return { claims: existingClaims, changed: false };
    }

    const updatedClaims = {
      ...existingClaims,
      role: role === "user" ? undefined : role,
    };

    if (updatedClaims.role === undefined) {
      delete updatedClaims.role;
    }

    await this.gateway.setCustomUserClaims(uid, Object.keys(updatedClaims).length > 0 ? updatedClaims : null);
    await this.gateway.revokeRefreshTokens(uid);

    return { claims: updatedClaims, changed: true };
  }

  async removeRole(uid: string): Promise<{ claims: { [key: string]: any }; changed: boolean }> {
    return this.setRole(uid, "user");
  }

  async bootstrapSuperAdmin(uid: string, confirmFlag: boolean): Promise<{ claims: { [key: string]: any }; changed: boolean }> {
    this.validateUid(uid);
    if (!confirmFlag) {
      throw new Error(
        "Accidental execution safeguard: Must provide the explicit '--confirm-super-admin-bootstrap' flag to bootstrap the first super admin."
      );
    }

    const user = await this.gateway.getUser(uid);
    const existingClaims = user.customClaims || {};

    // 2. Reject bootstrapping if super_admin is already assigned
    if (existingClaims.role === "super_admin") {
      throw new Error("Super admin role already bootstrapped for this user.");
    }

    return this.setRole(uid, "super_admin");
  }

  async revokeTokens(uid: string): Promise<void> {
    this.validateUid(uid);
    await this.gateway.revokeRefreshTokens(uid);
  }
}
