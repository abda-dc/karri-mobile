import type { UserReputation } from "./UserReputation";

export interface ReputationRepository {
  findById(userId: string): Promise<UserReputation | null>;
  watchById(
    userId: string,
    onData: (reputation: UserReputation | null) => void,
    onError: (error: Error) => void,
  ): () => void;
}
