import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { NewProfile, Profile } from "../../../domain/profile/Profile";
import type { ProfileRepository } from "../../../domain/profile/ProfileRepository";
import { getFirebaseServices } from "../client";
import { mapProfile, toFirestoreProfile } from "../mappers/profileMapper";

export class FirebaseProfileRepository implements ProfileRepository {
  async create(profile: NewProfile): Promise<Profile> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "profiles", profile.userId);
    await setDoc(reference, {
      ...toFirestoreProfile(profile),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return mapProfile(await getDoc(reference));
  }

  async findByUserId(userId: string): Promise<Profile | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "profiles", userId));
    return snapshot.exists() ? mapProfile(snapshot) : null;
  }

  async save(profile: Profile): Promise<Profile> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "profiles", profile.userId);
    await setDoc(reference, {
      ...toFirestoreProfile(profile),
      updatedAt: serverTimestamp(),
    });
    return mapProfile(await getDoc(reference));
  }
}
