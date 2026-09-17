export interface StarDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface UserReputationRecord {
  userId: string;
  averageRating: number | null;
  reviewCount: number;
  distribution: StarDistribution;
  completedBookingsCount: number;
  cancelledBookingsCount: number;
  completionRate: number | null;
  updatedAt: any;
}
