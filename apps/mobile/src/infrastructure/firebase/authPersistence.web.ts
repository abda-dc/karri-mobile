import { browserLocalPersistence } from "firebase/auth";

// Web platform uses local browser persistence.
export const firebaseAuthPersistence = browserLocalPersistence;
