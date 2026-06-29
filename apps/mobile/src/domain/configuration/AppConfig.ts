export interface FeatureFlags {
  readonly bookingRequests: boolean;
  readonly inAppNotifications: boolean;
  readonly reviews: boolean;
  readonly trustScores: boolean;
}

export interface CountryConfig {
  readonly code: string;
  readonly name: string;
  readonly enabled: boolean;
}

export interface CorridorConfig {
  readonly id: string;
  readonly originCountry: string;
  readonly destinationCountry: string;
  readonly enabled: boolean;
}

export interface PackageCategories {
  readonly values: ReadonlyArray<string>;
}

export interface ProhibitedItems {
  readonly values: ReadonlyArray<string>;
  readonly guidanceUrl: string | null;
}

export interface VerificationRequirements {
  readonly senderLevel: "none" | "basic" | "identity";
  readonly travelerLevel: "none" | "basic" | "identity";
}

export interface AppConfig {
  readonly schemaVersion: 1;
  readonly countries: ReadonlyArray<CountryConfig>;
  readonly corridors: ReadonlyArray<CorridorConfig>;
  readonly featureFlags: FeatureFlags;
  readonly packageCategories: PackageCategories;
  readonly prohibitedItems: ProhibitedItems;
  readonly verificationRequirements: VerificationRequirements;
}

export const defaultAppConfig: AppConfig = {
  schemaVersion: 1,
  countries: [],
  corridors: [],
  featureFlags: {
    bookingRequests: false,
    inAppNotifications: false,
    reviews: false,
    trustScores: false,
  },
  packageCategories: { values: [] },
  prohibitedItems: { values: [], guidanceUrl: null },
  verificationRequirements: { senderLevel: "none", travelerLevel: "none" },
};
