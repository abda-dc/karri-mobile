import { browserLocalPersistence } from "firebase/auth";

// Expo web uses the browser's local persistence implementation.
export const firebaseAuthPersistence = browserLocalPersistence;
