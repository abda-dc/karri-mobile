import type { CalculateTrustDto } from "../dto/commands";
import { TrustCalculator } from "../../domain/trust/TrustCalculator";
import type { TrustRepository } from "../../domain/trust/TrustRepository";
import type { TrustScore } from "../../domain/trust/TrustScore";
import type { Clock } from "./Clock";
import { systemClock } from "./Clock";
import { DomainValidationError, requireText } from "./validation";

export class TrustService {
  constructor(
    private readonly trustScores: TrustRepository,
    private readonly calculator: TrustCalculator = new TrustCalculator(),
    private readonly clock: Clock = systemClock,
  ) {}

  async calculate(input: CalculateTrustDto): Promise<TrustScore> {
    const userId = requireText(input.userId, "userId", 128);
    const values = [
      input.inputs.completedDeliveries,
      input.inputs.cancellations,
      input.inputs.reviewCount,
      input.inputs.accountAgeDays,
    ];

    if (values.some((value) => !Number.isFinite(value) || value < 0)) {
      throw new DomainValidationError("Trust inputs must be finite, non-negative values.");
    }

    if (
      input.inputs.averageReview !== null &&
      (!Number.isFinite(input.inputs.averageReview) ||
        input.inputs.averageReview < 1 ||
        input.inputs.averageReview > 5)
    ) {
      throw new DomainValidationError("averageReview must be null or a value from 1 to 5.");
    }

    return this.trustScores.save(
      this.calculator.calculate(userId, input.inputs, this.clock.now()),
    );
  }
}
