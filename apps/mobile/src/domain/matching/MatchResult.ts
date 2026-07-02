import type { VerificationStatus } from "../identity/IdentityVerification";
import type { Shipment } from "../shipment/Shipment";
import type { Trip } from "../trip/Trip";
import type { MatchReason } from "./MatchReason";
import type { MatchScore } from "./MatchScore";

export const MatchDataFreshness = {
  Cached: "cached",
  Live: "live",
  Unknown: "unknown",
} as const;

export type MatchDataFreshness =
  (typeof MatchDataFreshness)[keyof typeof MatchDataFreshness];

export interface MatchEvidence {
  readonly completedDeliveries: number | null;
  readonly identityStatus: VerificationStatus | null;
  readonly trustScore: number | null;
}

export interface MatchResult {
  readonly dataFreshness: MatchDataFreshness;
  readonly eligible: boolean;
  readonly evaluatedAt: string;
  readonly id: string;
  readonly reasons: ReadonlyArray<MatchReason>;
  readonly score: MatchScore;
  readonly shipment: Shipment;
  readonly trip: Trip;
}
