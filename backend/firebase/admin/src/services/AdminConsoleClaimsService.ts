import type {
  FirebaseAdminConsoleGateway,
  FirebaseAdminUser,
} from "../gateways/FirebaseAdminGateway.js";

export const ADMIN_CONSOLE_ROLES = [
  "moderator",
  "operations_admin",
  "safety_admin",
  "super_admin",
] as const;

export type AdminConsoleRole = typeof ADMIN_CONSOLE_ROLES[number];

export type AdminTarget =
  { readonly uid?: string; readonly email?: string };

export interface AdminConsoleClaimStatus {
  readonly target: string;
  readonly role: string | null;
  readonly approved: boolean;
  readonly unrelatedClaimCount: number;
}

function redactUid(uid: string): string {
  const suffix = uid.slice(-6);
  return `uid:***${suffix}`;
}

function validateUid(uid: string): string {
  const normalized = uid.trim();
  if (!normalized || normalized.length > 128) {
    throw new Error("A valid Firebase UID is required.");
  }
  return normalized;
}

function validateEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 254 || !normalized.includes("@")) {
    throw new Error("A valid Firebase user email is required.");
  }
  return normalized;
}

function validateRole(role: string): AdminConsoleRole {
  if (!ADMIN_CONSOLE_ROLES.includes(role as AdminConsoleRole)) {
    throw new Error(
      `Role must be one of: ${ADMIN_CONSOLE_ROLES.join(", ")}.`,
    );
  }
  return role as AdminConsoleRole;
}

export class AdminConsoleClaimsService {
  constructor(private readonly gateway: FirebaseAdminConsoleGateway) {}

  private async resolveTarget(target: AdminTarget): Promise<FirebaseAdminUser> {
    let user: FirebaseAdminUser;
    if (target.uid !== undefined) {
      user = await this.gateway.getUser(validateUid(target.uid));
    } else if (target.email !== undefined) {
      user = await this.gateway.getUserByEmail(validateEmail(target.email));
    } else {
      throw new Error("A Firebase UID or email target is required.");
    }

    const providers = user.providerIds ?? [];
    if (!user.email || !providers.includes("password")) {
      throw new Error(
        "The target must be an existing non-anonymous Firebase Email/Password user.",
      );
    }

    return user;
  }

  private status(user: FirebaseAdminUser): AdminConsoleClaimStatus {
    const claims = user.customClaims ?? {};
    const role = typeof claims.role === "string" ? claims.role : null;
    return {
      target: redactUid(user.uid),
      role,
      approved: ADMIN_CONSOLE_ROLES.includes(role as AdminConsoleRole),
      unrelatedClaimCount: Object.keys(claims).filter((key) => key !== "role").length,
    };
  }

  async verify(target: AdminTarget): Promise<AdminConsoleClaimStatus> {
    return this.status(await this.resolveTarget(target));
  }

  async grant(
    target: AdminTarget,
    roleInput: string,
    productionConfirmed: boolean,
  ): Promise<{ readonly changed: boolean; readonly status: AdminConsoleClaimStatus }> {
    if (!productionConfirmed) {
      throw new Error(
        "Production mutation refused. Add '--confirm-production' only with owner authorization.",
      );
    }

    const role = validateRole(roleInput);
    const user = await this.resolveTarget(target);
    const existingClaims = user.customClaims ?? {};

    if (existingClaims.role === role) {
      return { changed: false, status: this.status(user) };
    }

    const updatedClaims = { ...existingClaims, role };
    await this.gateway.setCustomUserClaims(user.uid, updatedClaims);
    await this.gateway.revokeRefreshTokens(user.uid);

    return {
      changed: true,
      status: this.status({ ...user, customClaims: updatedClaims }),
    };
  }

  async remove(
    target: AdminTarget,
    productionConfirmed: boolean,
  ): Promise<{ readonly changed: boolean; readonly status: AdminConsoleClaimStatus }> {
    if (!productionConfirmed) {
      throw new Error(
        "Production mutation refused. Add '--confirm-production' only with owner authorization.",
      );
    }

    const user = await this.resolveTarget(target);
    const existingClaims = user.customClaims ?? {};
    if (!Object.prototype.hasOwnProperty.call(existingClaims, "role")) {
      return { changed: false, status: this.status(user) };
    }

    const updatedClaims = { ...existingClaims };
    delete updatedClaims.role;
    await this.gateway.setCustomUserClaims(
      user.uid,
      Object.keys(updatedClaims).length > 0 ? updatedClaims : null,
    );
    await this.gateway.revokeRefreshTokens(user.uid);

    return {
      changed: true,
      status: this.status({ ...user, customClaims: updatedClaims }),
    };
  }
}
