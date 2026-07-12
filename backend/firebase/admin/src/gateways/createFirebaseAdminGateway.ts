import admin from "firebase-admin";
import type { FirebaseAdminGateway } from "./FirebaseAdminGateway.js";

export function createFirebaseAdminGateway(): FirebaseAdminGateway {
  if (admin.apps.length === 0) {
    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

    const isEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

    if (isEmulator) {
      admin.initializeApp({
        projectId: projectId || "demo-karri-mobile",
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }
  }

  return {
    async setCustomUserClaims(uid: string, claims: object | null): Promise<void> {
      await admin.auth().setCustomUserClaims(uid, claims);
    },
    async getUser(uid: string) {
      const userRecord = await admin.auth().getUser(uid);
      return {
        uid: userRecord.uid,
        customClaims: userRecord.customClaims,
      };
    },
    async revokeRefreshTokens(uid: string): Promise<void> {
      await admin.auth().revokeRefreshTokens(uid);
    },
  };
}
