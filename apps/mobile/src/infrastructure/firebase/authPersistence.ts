import { inMemoryPersistence } from "firebase/auth";

// safe fallback persistence
export const firebaseAuthPersistence = inMemoryPersistence;
