import type { TrustRule } from "./TrustRule";
import type { TrustFactorResult, TrustInputs, TrustScore } from "./TrustScore";

const round = (value: number): number => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

function describeVerificationLevel(level: TrustInputs["verificationLevel"]): string {
  switch (level) {
    case "identity":
      return "Verified identity evidence contributed 20 points.";
    case "basic":
      return "Identity verification is in progress and contributed 10 points.";
    case "none":
      return "No identity verification evidence contributed 0 points.";
  }
}

export const defaultTrustRules: ReadonlyArray<TrustRule> = [
  {
    key: "completed_deliveries",
    calculate(inputs) {
      const completedDeliveries = Math.max(0, inputs.completedDeliveries);
      const cappedDeliveries = clamp(completedDeliveries, 0, 10);
      const points = round(cappedDeliveries * 4);

      return {
        key: this.key,
        points,
        explanation:
          completedDeliveries > 0
            ? `${completedDeliveries} completed deliveries contributed ${points} points.`
            : "No completed deliveries contributed 0 points.",
      };
    },
  },
  {
    key: "cancellations",
    calculate(inputs) {
      const cancellations = Math.max(0, inputs.cancellations);
      const points = -round(clamp(cancellations, 0, 5) * 5);

      return {
        key: this.key,
        points,
        explanation:
          cancellations > 0
            ? `${cancellations} cancellations reduced trust by ${Math.abs(points)} points.`
            : "No cancellations reduced trust.",
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
          inputs.reviewCount > 0 && inputs.averageReview !== null
            ? `${inputs.reviewCount} eligible reviews averaged ${inputs.averageReview.toFixed(
                1,
              )}/5 and contributed ${points} points.`
            : "No eligible reviews contributed 0 points.",
      };
    },
  },
  {
    key: "account_age",
    calculate(inputs) {
      const accountAgeDays = Math.max(0, inputs.accountAgeDays);
      const points = round((clamp(accountAgeDays, 0, 365) / 365) * 15);

      return {
        key: this.key,
        points,
        explanation:
          accountAgeDays > 0
            ? `${accountAgeDays} account days contributed ${points} points.`
            : "New account age contributed 0 points.",
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
        explanation: describeVerificationLevel(inputs.verificationLevel),
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
    const score = round(
      clamp(
        factors.reduce((total, factor) => total + factor.points, 0),
        0,
        100,
      ),
    );

    return {
      userId,
      score,
      formulaVersion: 1,
      factors,
      calculatedAt,
    };
  }
}
