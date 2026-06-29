import type { NewUser, User } from "./User";

export interface UserRepository {
  create(userId: string, user: NewUser): Promise<User>;
  findById(userId: string): Promise<User | null>;
  save(user: User): Promise<User>;
}
