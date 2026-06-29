import type { NewProfile, Profile } from "./Profile";

export interface ProfileRepository {
  create(profile: NewProfile): Promise<Profile>;
  findByUserId(userId: string): Promise<Profile | null>;
  save(profile: Profile): Promise<Profile>;
}
