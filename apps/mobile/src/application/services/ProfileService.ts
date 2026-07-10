import type {
  NewProfile,
  Profile,
  UserRole,
} from "../../domain/profile/Profile";
import type { ProfileRepository } from "../../domain/profile/ProfileRepository";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

const allowedRoles: ReadonlyArray<UserRole> = ["sender", "traveler"];

export interface SaveProfileInput {
  readonly displayName: string;
  readonly homeRegion: string;
  readonly primaryDestinationCountry: string;
  readonly roles: ReadonlyArray<string>;
  readonly userId: string;
}

export class ProfileService {
  constructor(
    private readonly profiles: ProfileRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.profiles.findByUserId(requireText(userId, "userId", 128));
  }

  async saveProfile(input: SaveProfileInput): Promise<Profile> {
    const userId = requireText(input.userId, "userId", 128);
    const profileFields = {
      displayName: requireText(input.displayName, "displayName", 120),
      homeRegion: requireText(input.homeRegion, "homeRegion", 120),
      primaryDestinationCountry: requireText(
        input.primaryDestinationCountry,
        "primaryDestinationCountry",
        80,
      ),
      roles: this.validateRoles(input.roles),
      userId,
    };

    const existing = await this.profiles.findByUserId(userId);
    const now = this.clock.now();

    if (!existing) {
      const profile: NewProfile = {
        ...profileFields,
        status: "active",
        trustScore: null,
      };
      return this.profiles.create(profile);
    }

    if (existing.id !== userId || existing.userId !== userId) {
      throw new DomainValidationError(
        "Profiles can only be saved for the active user.",
      );
    }

    return this.profiles.save({
      ...existing,
      ...profileFields,
      createdAt: existing.createdAt,
      status: existing.status,
      trustScore: existing.trustScore,
      updatedAt: now,
    });
  }

  private validateRoles(values: ReadonlyArray<string>): ReadonlyArray<UserRole> {
    const roles = values.reduce<UserRole[]>((selectedRoles, value) => {
      if (!allowedRoles.includes(value as UserRole)) {
        throw new DomainValidationError("Profile role is not supported.");
      }
      const role = value as UserRole;
      return selectedRoles.includes(role)
        ? selectedRoles
        : [...selectedRoles, role];
    }, []);

    if (roles.length === 0) {
      throw new DomainValidationError("Select at least one profile role.");
    }

    return roles;
  }
}
