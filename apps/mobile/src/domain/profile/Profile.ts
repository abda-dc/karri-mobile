import type { DomainEntity } from "../shared/Entity";

export type UserRole = "sender" | "traveler";
export type ProfileStatus = "incomplete" | "active";

export interface Profile extends DomainEntity {
  readonly userId: string;
  readonly displayName: string;
  readonly homeRegion: string;
  readonly primaryDestinationCountry: string;
  readonly roles: ReadonlyArray<UserRole>;
  readonly trustScore: number | null;
  readonly status: ProfileStatus;
}

export type NewProfile = Omit<Profile, "id" | "createdAt" | "updatedAt">;
