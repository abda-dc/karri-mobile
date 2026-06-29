import type { DomainEntity } from "../shared/Entity";

export type UserStatus = "active" | "disabled";

export interface User extends DomainEntity {
  readonly email: string | null;
  readonly status: UserStatus;
}

export type NewUser = Omit<User, "id" | "createdAt" | "updatedAt">;
