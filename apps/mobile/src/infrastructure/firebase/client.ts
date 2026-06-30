import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";
import { Firestore, getFirestore, initializeFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { firebaseAuthPersistence } from "./authPersistence";
import { firestoreLocalCache } from "./firestoreCache";

const firebaseEnvironment = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const environmentNames = {
  apiKey: "EXPO_PUBLIC_FIREBASE_API_KEY",
  authDomain: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "EXPO_PUBLIC_FIREBASE_APP_ID",
} as const;

export const missingFirebaseVariables = Object.entries(firebaseEnvironment)
  .filter(([, value]) => !value || value.startsWith("your-"))
  .map(([key]) => environmentNames[key as keyof typeof environmentNames]);

export const isFirebaseConfigured = missingFirebaseVariables.length === 0;

export class FirebaseConfigurationError extends Error {
  constructor() {
    super(
      "Firebase is not configured. Copy apps/mobile/.env.example to .env.local and add your Firebase web app values.",
    );
    this.name = "FirebaseConfigurationError";
  }
}

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestore: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseEnvironment);

  try {
    firebaseAuth = initializeAuth(firebaseApp, {
      persistence: firebaseAuthPersistence,
    });
  } catch {
    // Expo Fast Refresh can evaluate this module after Auth already exists.
    firebaseAuth = getAuth(firebaseApp);
  }

  try {
    firestore = initializeFirestore(firebaseApp, { localCache: firestoreLocalCache });
  } catch {
    // Expo Fast Refresh can evaluate this module after Firestore already exists.
    firestore = getFirestore(firebaseApp);
  }
  firebaseStorage = getStorage(firebaseApp);
}

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
};

export function getFirebaseServices(): FirebaseServices {
  if (!firebaseApp || !firebaseAuth || !firestore || !firebaseStorage) {
    throw new FirebaseConfigurationError();
  }

  return {
    app: firebaseApp,
    auth: firebaseAuth,
    db: firestore,
    storage: firebaseStorage,
  };
}

// FCM and App Check remain uninitialized until their product flows, native
// configuration, consent, and enforcement plans are implemented.
export const futureFirebaseServices = {
  appCheck: "not-initialized",
  cloudMessaging: "not-initialized",
} as const;
