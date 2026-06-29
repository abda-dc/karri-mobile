import type { DocumentData, DocumentSnapshot } from "firebase/firestore";
import type { NewProfile, Profile } from "../../../domain/profile/Profile";
import {
  numberValue,
  snapshotData,
  stringArray,
  stringValue,
  toDomainTimestamp,
  toFirestoreTimestamp,
} from "./firestoreValues";

export function mapProfile(snapshot: DocumentSnapshot<DocumentData>): Profile {
  const data = snapshotData(snapshot);

  return {
    id: snapshot.id,
    userId: stringValue(data.userId, snapshot.id),
    displayName: stringValue(data.displayName),
    homeRegion: stringValue(data.homeRegion),
    primaryDestinationCountry: stringValue(data.primaryDestinationCountry),
    roles: stringArray(data.roles) as Profile["roles"],
    trustScore: typeof data.trustScore === "number" ? numberValue(data.trustScore) : null,
    status: data.status as Profile["status"],
    createdAt: toDomainTimestamp(data.createdAt),
    updatedAt: toDomainTimestamp(data.updatedAt),
  };
}

export function toFirestoreProfile(profile: NewProfile | Profile): DocumentData {
  const timestamps = "createdAt" in profile
    ? {
        createdAt: toFirestoreTimestamp(profile.createdAt),
        updatedAt: toFirestoreTimestamp(profile.updatedAt),
      }
    : {};

  return {
    userId: profile.userId,
    displayName: profile.displayName,
    homeRegion: profile.homeRegion,
    primaryDestinationCountry: profile.primaryDestinationCountry,
    roles: profile.roles,
    trustScore: profile.trustScore,
    status: profile.status,
    ...timestamps,
  };
}
