import type { TrustScore } from "./TrustScore";

export interface TrustRepository {
  findByUserId(userId: string): Promise<TrustScore | null>;
  save(score: TrustScore): Promise<TrustScore>;
}
