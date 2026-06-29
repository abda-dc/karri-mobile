export type VerificationLevel = "none" | "basic" | "identity";

export interface TrustInputs {
  readonly completedDeliveries: number;
  readonly cancellations: number;
  readonly averageReview: number | null;
  readonly reviewCount: number;
  readonly accountAgeDays: number;
  readonly verificationLevel: VerificationLevel;
}

export type TrustFactorKey =
  | "completed_deliveries"
  | "cancellations"
  | "average_review"
  | "account_age"
  | "verification_level";

export interface TrustFactorResult {
  readonly key: TrustFactorKey;
  readonly points: number;
  readonly explanation: string;
}

export interface TrustScore {
  readonly userId: string;
  readonly score: number;
  readonly formulaVersion: 1;
  readonly factors: ReadonlyArray<TrustFactorResult>;
  readonly calculatedAt: string;
}
