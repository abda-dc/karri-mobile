export const IdentityDocumentType = {
  Passport: "passport",
  NationalId: "national_id",
  DriversLicense: "drivers_license",
  ResidencePermit: "residence_permit",
  Other: "other",
} as const;

export type IdentityDocumentType =
  (typeof IdentityDocumentType)[keyof typeof IdentityDocumentType];

/** Metadata only. Document bytes, OCR text, and public download URLs do not belong here. */
export interface IdentityDocument {
  readonly id: string;
  readonly type: IdentityDocumentType;
  readonly label: string;
  readonly issuingCountryCode: string | null;
  readonly expiresAt: string | null;
  readonly storagePath: string | null;
  readonly uploadedAt: string | null;
}

export type IdentityDocumentMetadataInput = IdentityDocument;
