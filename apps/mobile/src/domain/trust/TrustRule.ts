import type { TrustFactorResult, TrustInputs } from "./TrustScore";

export interface TrustRule {
  readonly key: TrustFactorResult["key"];
  calculate(inputs: TrustInputs): TrustFactorResult;
}
