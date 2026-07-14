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
