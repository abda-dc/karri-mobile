import type { MatchFactor } from "./MatchReason";

export interface MatchFactorScore {
  readonly earnedPoints: number;
  readonly factor: MatchFactor;
  readonly maximumPoints: number;
}

export interface MatchScore {
  readonly factors: ReadonlyArray<MatchFactorScore>;
  readonly formulaVersion: 1;
  readonly maximum: 100;
  readonly total: number;
}
