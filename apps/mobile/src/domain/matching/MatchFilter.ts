export interface MatchFilter {
  readonly allowedPackageCategories: ReadonlyArray<string>;
  readonly blockedPackageCategories: ReadonlyArray<string>;
  readonly eligibleOnly: boolean;
  readonly includeSameOwner: boolean;
  readonly maximumResults: number;
  readonly maximumTimingGapDays: number;
  readonly minimumScore: number;
  readonly requireCapacity: boolean;
  readonly requireExactRoute: boolean;
  readonly requireIdentityVerification: boolean;
  readonly requirePackageCompatibility: boolean;
  readonly requireTimingOverlap: boolean;
  readonly shipmentIds: ReadonlyArray<string>;
  readonly tripIds: ReadonlyArray<string>;
  readonly viewerId: string;
}

export const defaultMatchFilter: MatchFilter = {
  allowedPackageCategories: [],
  blockedPackageCategories: [],
  eligibleOnly: true,
  includeSameOwner: false,
  maximumResults: 50,
  maximumTimingGapDays: 14,
  minimumScore: 0,
  requireCapacity: true,
  requireExactRoute: true,
  requireIdentityVerification: false,
  requirePackageCompatibility: false,
  requireTimingOverlap: false,
  shipmentIds: [],
  tripIds: [],
  viewerId: "",
};

export class InvalidMatchFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMatchFilterError";
  }
}

export function createMatchFilter(
  input: Partial<MatchFilter> = {},
): MatchFilter {
  const definedInput = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<MatchFilter>;
  const filter: MatchFilter = { ...defaultMatchFilter, ...definedInput };

  if (!Number.isInteger(filter.maximumResults) || filter.maximumResults < 1 || filter.maximumResults > 100) {
    throw new InvalidMatchFilterError("maximumResults must be an integer from 1 to 100.");
  }
  if (
    !Number.isInteger(filter.maximumTimingGapDays) ||
    filter.maximumTimingGapDays < 0 ||
    filter.maximumTimingGapDays > 365
  ) {
    throw new InvalidMatchFilterError(
      "maximumTimingGapDays must be an integer from 0 to 365.",
    );
  }
  if (!Number.isFinite(filter.minimumScore) || filter.minimumScore < 0 || filter.minimumScore > 100) {
    throw new InvalidMatchFilterError("minimumScore must be from 0 to 100.");
  }

  return {
    ...filter,
    allowedPackageCategories: normalizeValues(filter.allowedPackageCategories),
    blockedPackageCategories: normalizeValues(filter.blockedPackageCategories),
    shipmentIds: normalizeValues(filter.shipmentIds, false),
    tripIds: normalizeValues(filter.tripIds, false),
    viewerId: filter.viewerId.trim(),
  };
}

function normalizeValues(
  values: ReadonlyArray<string>,
  lowerCase = true,
): ReadonlyArray<string> {
  return [
    ...new Set(
      values
        .map((value) => value.trim().replace(/\s+/g, " "))
        .filter(Boolean)
        .map((value) => (lowerCase ? value.toLocaleLowerCase() : value)),
    ),
  ];
}
