import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { NewUser, User } from "../../../domain/user/User";
import type { UserRepository } from "../../../domain/user/UserRepository";
import { getFirebaseServices } from "../client";
import { mapUser, toFirestoreUser } from "../mappers/userMapper";

export class FirebaseUserRepository implements UserRepository {
  async create(userId: string, user: NewUser): Promise<User> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "users", userId);
    await setDoc(reference, {
      ...toFirestoreUser(user, userId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return mapUser(await getDoc(reference));
  }

  async findById(userId: string): Promise<User | null> {
    const { db } = getFirebaseServices();
    const snapshot = await getDoc(doc(db, "users", userId));
    return snapshot.exists() ? mapUser(snapshot) : null;
  }

  async save(user: User): Promise<User> {
    const { db } = getFirebaseServices();
    const reference = doc(db, "users", user.id);
    await setDoc(reference, {
      ...toFirestoreUser(user, user.id),
      updatedAt: serverTimestamp(),
    });
    return mapUser(await getDoc(reference));
  }
}
