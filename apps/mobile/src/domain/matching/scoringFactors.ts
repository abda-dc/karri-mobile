import { VerificationStatus } from "../identity/IdentityVerification";
import { ListingStatus, type Shipment } from "../shipment/Shipment";
import type { Trip } from "../trip/Trip";
import type { MatchFilter } from "./MatchFilter";
import {
  MatchFactor,
  MatchReasonTone,
  type MatchReason,
} from "./MatchReason";
import type { MatchEvidence } from "./MatchResult";
import type { MatchFactorScore, MatchScore } from "./MatchScore";

interface FactorEvaluation {
  readonly reason: MatchReason;
  readonly score: MatchFactorScore;
}

export interface MatchEvaluation {
  readonly eligible: boolean;
  readonly reasons: ReadonlyArray<MatchReason>;
  readonly score: MatchScore;
}

const maximumPoints = {
  [MatchFactor.RouteSimilarity]: 25,
  [MatchFactor.TimingCompatibility]: 15,
  [MatchFactor.Capacity]: 15,
  [MatchFactor.PackageCompatibility]: 10,
  [MatchFactor.TrustScore]: 15,
  [MatchFactor.IdentityVerification]: 10,
  [MatchFactor.HistoricalDeliverySuccess]: 10,
} as const;

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function factor(
  name: keyof typeof maximumPoints,
  earnedPoints: number,
): MatchFactorScore {
  return {
    earnedPoints: Math.max(0, Math.min(maximumPoints[name], Math.round(earnedPoints))),
    factor: name,
    maximumPoints: maximumPoints[name],
  };
}

export function scoreRouteSimilarity(
  shipment: Shipment,
  trip: Trip,
  filter: MatchFilter,
): FactorEvaluation {
  const comparisons = [
    { label: "origin country", points: 5, matches: normalize(shipment.originCountry) === normalize(trip.originCountry) },
    { label: "origin city", points: 8, matches: normalize(shipment.originCity) === normalize(trip.originCity) },
    { label: "destination country", points: 5, matches: normalize(shipment.destinationCountry) === normalize(trip.destinationCountry) },
    { label: "destination city", points: 7, matches: normalize(shipment.destinationCity) === normalize(trip.destinationCity) },
  ] as const;
  const matched = comparisons.filter(({ matches }) => matches);
  const points = matched.reduce((total, entry) => total + entry.points, 0);
  const exact = matched.length === comparisons.length;
  const missing = comparisons.filter(({ matches }) => !matches).map(({ label }) => label);

  return {
    score: factor(MatchFactor.RouteSimilarity, points),
    reason: {
      code: exact ? "route_exact" : "route_partial",
      explanation: exact
        ? "Origin and destination cities and countries match."
        : `Route differs by ${missing.join(", ")}.`,
      factor: MatchFactor.RouteSimilarity,
      title: exact ? "Exact route" : "Partial route",
      tone: filter.requireExactRoute && !exact
        ? MatchReasonTone.Blocking
        : points > 0
          ? MatchReasonTone.Cautionary
          : MatchReasonTone.Blocking,
    },
  };
}

export function scoreTimingCompatibility(
  shipment: Shipment,
  trip: Trip,
  filter: MatchFilter,
): FactorEvaluation {
  const window = parseDeliveryWindow(shipment.deliveryWindow);
  const tripStart = parseIsoDate(trip.departureDate);
  const tripEnd = parseIsoDate(trip.arrivalDate);

  if (!window || !tripStart || !tripEnd) {
    return {
      score: factor(MatchFactor.TimingCompatibility, 5),
      reason: {
        code: "timing_unstructured",
        explanation: "The delivery window is not structured enough for a reliable date comparison.",
        factor: MatchFactor.TimingCompatibility,
        title: "Timing needs review",
        tone: filter.requireTimingOverlap ? MatchReasonTone.Blocking : MatchReasonTone.Neutral,
      },
    };
  }

  const arrivalInsideWindow = tripEnd >= window.start && tripEnd <= window.end;
  const rangesOverlap = tripStart <= window.end && tripEnd >= window.start;
  const gapDays = rangesOverlap ? 0 : intervalGapDays(tripStart, tripEnd, window.start, window.end);
  let points = 0;
  let title = "Timing is outside the window";
  let explanation = `Trip dates are ${gapDays} days from the requested delivery window.`;
  let tone: MatchReason["tone"] = filter.requireTimingOverlap
    ? MatchReasonTone.Blocking
    : MatchReasonTone.Cautionary;

  if (arrivalInsideWindow) {
    points = 15;
    title = "Arrival fits the window";
    explanation = "The trip arrival date falls inside the requested delivery window.";
    tone = MatchReasonTone.Positive;
  } else if (rangesOverlap) {
    points = 10;
    title = "Trip overlaps the window";
    explanation = "Part of the trip overlaps the requested delivery window; confirm the handoff timing.";
    tone = MatchReasonTone.Positive;
  } else if (gapDays <= filter.maximumTimingGapDays) {
    points = Math.max(1, 9 - Math.floor((gapDays / Math.max(1, filter.maximumTimingGapDays)) * 8));
  }

  return {
    score: factor(MatchFactor.TimingCompatibility, points),
    reason: {
      code: arrivalInsideWindow
        ? "timing_arrival_inside"
        : rangesOverlap
          ? "timing_overlap"
          : "timing_gap",
      explanation,
      factor: MatchFactor.TimingCompatibility,
      title,
      tone,
    },
  };
}

export function scoreCapacity(
  shipment: Shipment,
  trip: Trip,
  filter: MatchFilter,
): FactorEvaluation {
  const enough = shipment.weightKg <= trip.availableCapacityKg;
  const difference = Math.abs(trip.availableCapacityKg - shipment.weightKg);
  return {
    score: factor(MatchFactor.Capacity, enough ? 15 : 0),
    reason: {
      code: enough ? "capacity_available" : "capacity_insufficient",
      explanation: enough
        ? `The trip has ${difference.toFixed(1)} kg of capacity remaining after this shipment.`
        : `The shipment exceeds available capacity by ${difference.toFixed(1)} kg.`,
      factor: MatchFactor.Capacity,
      title: enough ? "Capacity available" : "Not enough capacity",
      tone: enough
        ? MatchReasonTone.Positive
        : filter.requireCapacity
          ? MatchReasonTone.Blocking
          : MatchReasonTone.Cautionary,
    },
  };
}

export function scorePackageCompatibility(
  shipment: Shipment,
  filter: MatchFilter,
): FactorEvaluation {
  const category = normalize(shipment.packageCategory);
  const blocked = filter.blockedPackageCategories.includes(category);
  const hasAllowList = filter.allowedPackageCategories.length > 0;
  const allowed = !hasAllowList || filter.allowedPackageCategories.includes(category);

  if (blocked || !allowed) {
    return {
      score: factor(MatchFactor.PackageCompatibility, 0),
      reason: {
        code: blocked ? "package_blocked" : "package_not_allowed",
        explanation: blocked
          ? "The package category is excluded by the selected filter."
          : "The package category is not in the selected allowed list.",
        factor: MatchFactor.PackageCompatibility,
        title: "Package category not compatible",
        tone: filter.requirePackageCompatibility || blocked
          ? MatchReasonTone.Blocking
          : MatchReasonTone.Cautionary,
      },
    };
  }

  return {
    score: factor(MatchFactor.PackageCompatibility, hasAllowList ? 10 : 5),
    reason: {
      code: hasAllowList ? "package_allowed" : "package_needs_review",
      explanation: hasAllowList
        ? "The package category is in the selected allowed list."
        : "No structured traveler category preferences are available; confirm package fit directly.",
      factor: MatchFactor.PackageCompatibility,
      title: hasAllowList ? "Package category supported" : "Package needs review",
      tone: hasAllowList ? MatchReasonTone.Positive : MatchReasonTone.Neutral,
    },
  };
}

export function scoreTrust(evidence: MatchEvidence): FactorEvaluation {
  if (evidence.trustScore === null) {
    return {
      score: factor(MatchFactor.TrustScore, 0),
      reason: {
        code: "trust_unavailable",
        explanation: "No visible trust summary was available for ranking.",
        factor: MatchFactor.TrustScore,
        title: "Trust evidence unavailable",
        tone: MatchReasonTone.Neutral,
      },
    };
  }

  const points = (Math.max(0, Math.min(100, evidence.trustScore)) / 100) * 15;
  return {
    score: factor(MatchFactor.TrustScore, points),
    reason: {
      code: "trust_scored",
      explanation: `The visible trust summary is ${Math.round(evidence.trustScore)} out of 100.`,
      factor: MatchFactor.TrustScore,
      title: "Visible trust evidence",
      tone: evidence.trustScore >= 60 ? MatchReasonTone.Positive : MatchReasonTone.Neutral,
    },
  };
}

export function scoreIdentityVerification(
  evidence: MatchEvidence,
  filter: MatchFilter,
): FactorEvaluation {
  const verified = evidence.identityStatus === VerificationStatus.Verified;
  const inProgressStatuses: ReadonlyArray<VerificationStatus> = [
    VerificationStatus.Draft,
    VerificationStatus.Submitted,
    VerificationStatus.UnderReview,
  ];
  const inProgress = evidence.identityStatus !== null &&
    inProgressStatuses.includes(evidence.identityStatus);
  const points = verified ? 10 : inProgress || evidence.identityStatus === null ? 5 : 0;

  return {
    score: factor(MatchFactor.IdentityVerification, points),
    reason: {
      code: verified
        ? "identity_verified"
        : evidence.identityStatus === null
          ? "identity_private"
          : inProgress
            ? "identity_in_progress"
            : "identity_not_verified",
      explanation: verified
        ? "Identity verification is complete."
        : evidence.identityStatus === null
          ? "Identity status is not visible in this matching context and is scored neutrally."
          : inProgress
            ? "Identity verification has started but is not complete."
            : "Identity verification is not complete.",
      factor: MatchFactor.IdentityVerification,
      title: verified ? "Identity verified" : "Identity not confirmed",
      tone: verified
        ? MatchReasonTone.Positive
        : filter.requireIdentityVerification
          ? MatchReasonTone.Blocking
          : MatchReasonTone.Neutral,
    },
  };
}

export function scoreHistoricalDeliverySuccess(
  evidence: MatchEvidence,
): FactorEvaluation {
  const completed = evidence.completedDeliveries;
  const points = completed === null ? 0 : completed >= 5 ? 10 : completed >= 2 ? 6 : completed === 1 ? 3 : 0;
  return {
    score: factor(MatchFactor.HistoricalDeliverySuccess, points),
    reason: {
      code: completed === null ? "history_unavailable" : "history_scored",
      explanation: completed === null
        ? "No visible completed-delivery history was available."
        : `${completed} eligible completed ${completed === 1 ? "delivery is" : "deliveries are"} visible.`,
      factor: MatchFactor.HistoricalDeliverySuccess,
      title: completed && completed > 0 ? "Completed delivery history" : "No completed delivery history",
      tone: completed && completed > 0 ? MatchReasonTone.Positive : MatchReasonTone.Neutral,
    },
  };
}

export function scoreMatch(
  shipment: Shipment,
  trip: Trip,
  evidence: MatchEvidence,
  filter: MatchFilter,
): MatchEvaluation {
  const evaluations = [
    scoreRouteSimilarity(shipment, trip, filter),
    scoreTimingCompatibility(shipment, trip, filter),
    scoreCapacity(shipment, trip, filter),
    scorePackageCompatibility(shipment, filter),
    scoreTrust(evidence),
    scoreIdentityVerification(evidence, filter),
    scoreHistoricalDeliverySuccess(evidence),
  ];
  const eligibilityReasons: Array<MatchReason> = [];

  if (shipment.status !== ListingStatus.Active || trip.status !== ListingStatus.Active) {
    eligibilityReasons.push({
      code: "listing_inactive",
      explanation: "Both the shipment and trip must be active.",
      factor: MatchFactor.Eligibility,
      title: "Inactive listing",
      tone: MatchReasonTone.Blocking,
    });
  }
  if (!filter.includeSameOwner && shipment.ownerId === trip.ownerId) {
    eligibilityReasons.push({
      code: "same_owner",
      explanation: "A sender cannot match their shipment to their own trip.",
      factor: MatchFactor.Eligibility,
      title: "Same participant",
      tone: MatchReasonTone.Blocking,
    });
  }

  const reasons = [...evaluations.map(({ reason }) => reason), ...eligibilityReasons];
  const factors = evaluations.map(({ score }) => score);
  const total = factors.reduce((sum, entry) => sum + entry.earnedPoints, 0);
  return {
    eligible: !reasons.some(({ tone }) => tone === MatchReasonTone.Blocking),
    reasons,
    score: {
      factors,
      formulaVersion: 1,
      maximum: 100,
      total,
    },
  };
}

function parseDeliveryWindow(value: string): { readonly start: number; readonly end: number } | null {
  const matches = value.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (matches.length === 0) return null;
  const parsed = matches.slice(0, 2).map(parseIsoDate);
  if (parsed.some((entry) => entry === null)) return null;
  const first = parsed[0] as number;
  const second = (parsed[1] ?? first) as number;
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function parseIsoDate(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function intervalGapDays(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): number {
  const milliseconds = leftEnd < rightStart ? rightStart - leftEnd : leftStart - rightEnd;
  return Math.max(0, Math.ceil(milliseconds / 86_400_000));
}
