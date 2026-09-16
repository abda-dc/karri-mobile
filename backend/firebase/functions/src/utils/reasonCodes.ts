export enum SafetyReviewReasonCode {
  RESTRICTED_ITEM = "restricted_item",
  PROHIBITED_ITEM = "prohibited_item",
  INSUFFICIENT_INFORMATION = "insufficient_information",
  HAZARDOUS_MATERIAL = "hazardous_material",
  DECLARATION_MISMATCH = "declaration_mismatch",
  DOCUMENTATION_MISSING = "documentation_missing",
  VERIFIED_SAFE = "verified_safe",
}

export enum AdministrativeHoldPlacementReasonCode {
  SAFETY_REVIEW_PENDING = "safety_review_pending",
  SUSPECTED_POLICY_VIOLATION = "suspected_policy_violation",
  IDENTITY_REVIEW_REQUIRED = "identity_review_required",
  PROHIBITED_CONTENTS = "prohibited_contents",
  MANUAL_INVESTIGATION = "manual_investigation",
}

export enum AdministrativeHoldReleaseReasonCode {
  REVIEW_COMPLETED = "review_completed",
  POLICY_CONCERN_CLEARED = "policy_concern_cleared",
  IDENTITY_CONFIRMED = "identity_confirmed",
  HOLD_PLACED_IN_ERROR = "hold_placed_in_error",
  NO_FURTHER_ACTION = "no_further_action",
}

export enum BookingCancellationReasonCode {
  SENDER_REQUESTED = "sender_requested",
  TRAVELER_UNAVAILABLE = "traveler_unavailable",
  SCHEDULE_CONFLICT = "schedule_conflict",
  FLIGHT_CANCELLED = "flight_cancelled",
  FAILED_PICKUP = "failed_pickup",
  NO_SHOW = "no_show",
  SAFETY_CONCERN = "safety_concern",
  MUTUAL_AGREEMENT = "mutual_agreement",
  OTHER = "other",
}

export enum BookingDeclineReasonCode {
  CAPACITY_UNAVAILABLE = "capacity_unavailable",
  SCHEDULE_MISMATCH = "schedule_mismatch",
  ROUTE_MISMATCH = "route_mismatch",
  UNABLE_TO_CARRY = "unable_to_carry",
  SAFETY_CONCERN = "safety_concern",
  OTHER = "other",
}
