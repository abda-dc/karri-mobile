export interface StarDistribution {
  readonly 1: number;
  readonly 2: number;
  readonly 3: number;
  readonly 4: number;
  readonly 5: number;
}

export interface UserReputation {
  readonly userId: string;
  readonly averageRating: number | null;
  readonly reviewCount: number;
  readonly distribution: StarDistribution;
  readonly completedBookingsCount: number;
  readonly cancelledBookingsCount: number;
  readonly completionRate: number | null;
  readonly updatedAt: string | null;
}
