export const MatchFactor = {
  RouteSimilarity: "route_similarity",
  TimingCompatibility: "timing_compatibility",
  Capacity: "capacity",
  PackageCompatibility: "package_compatibility",
  TrustScore: "trust_score",
  IdentityVerification: "identity_verification",
  HistoricalDeliverySuccess: "historical_delivery_success",
  Eligibility: "eligibility",
} as const;

export type MatchFactor = (typeof MatchFactor)[keyof typeof MatchFactor];

export const MatchReasonTone = {
  Positive: "positive",
  Neutral: "neutral",
  Cautionary: "cautionary",
  Blocking: "blocking",
} as const;

export type MatchReasonTone =
  (typeof MatchReasonTone)[keyof typeof MatchReasonTone];

export interface MatchReason {
  readonly code: string;
  readonly explanation: string;
  readonly factor: MatchFactor;
  readonly title: string;
  readonly tone: MatchReasonTone;
}
