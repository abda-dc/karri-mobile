import type { TrustRule } from "./TrustRule";
import type { TrustFactorResult, TrustInputs, TrustScore } from "./TrustScore";

const round = (value: number): number => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const defaultTrustRules: ReadonlyArray<TrustRule> = [
  {
    key: "completed_deliveries",
    calculate(inputs) {
      const points = round(clamp(inputs.completedDeliveries, 0, 10) * 4);
      return {
        key: this.key,
        points,
        explanation: `${Math.max(0, inputs.completedDeliveries)} completed deliveries contributed ${points} points.`,
      };
    },
  },
  {
    key: "cancellations",
    calculate(inputs) {
      const points = -round(clamp(inputs.cancellations, 0, 5) * 5);
      return {
        key: this.key,
        points,
        explanation: `${Math.max(0, inputs.cancellations)} cancellations contributed ${points} points.`,
      };
    },
  },
  {
    key: "average_review",
    calculate(inputs) {
      const points =
        inputs.reviewCount > 0 && inputs.averageReview !== null
          ? round((clamp(inputs.averageReview, 1, 5) / 5) * 25)
          : 0;
      return {
        key: this.key,
        points,
        explanation:
          inputs.reviewCount > 0
            ? `${inputs.reviewCount} eligible reviews contributed ${points} points.`
            : "No eligible reviews contributed 0 points.",
      };
    },
  },
  {
    key: "account_age",
    calculate(inputs) {
      const points = round((clamp(inputs.accountAgeDays, 0, 365) / 365) * 15);
      return {
        key: this.key,
        points,
        explanation: `${Math.max(0, inputs.accountAgeDays)} account days contributed ${points} points.`,
      };
    },
  },
  {
    key: "verification_level",
    calculate(inputs) {
      const pointsByLevel = { none: 0, basic: 10, identity: 20 } as const;
      const points = pointsByLevel[inputs.verificationLevel];
      return {
        key: this.key,
        points,
        explanation: `${inputs.verificationLevel} verification contributed ${points} points.`,
      };
    },
  },
];

export class TrustCalculator {
  constructor(private readonly rules: ReadonlyArray<TrustRule> = defaultTrustRules) {}

  calculate(userId: string, inputs: TrustInputs, calculatedAt: string): TrustScore {
    const factors: ReadonlyArray<TrustFactorResult> = this.rules.map((rule) =>
      rule.calculate(inputs),
    );
    const score = round(clamp(factors.reduce((total, factor) => total + factor.points, 0), 0, 100));

    return {
      userId,
      score,
      formulaVersion: 1,
      factors,
      calculatedAt,
    };
  }
}
