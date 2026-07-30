import admin from "firebase-admin";
import type { FirebaseAdminConsoleGateway } from "./FirebaseAdminGateway.js";

export function createFirebaseAdminGateway(explicitProjectId?: string): FirebaseAdminConsoleGateway {
  if (admin.apps.length === 0) {
    const projectId =
      explicitProjectId ||
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
        email: userRecord.email ?? null,
        providerIds: userRecord.providerData.map((provider) => provider.providerId),
        customClaims: userRecord.customClaims,
      };
    },
    async getUserByEmail(email: string) {
      const userRecord = await admin.auth().getUserByEmail(email);
      return {
        uid: userRecord.uid,
        email: userRecord.email ?? null,
        providerIds: userRecord.providerData.map((provider) => provider.providerId),
        customClaims: userRecord.customClaims,
      };
    },
    async revokeRefreshTokens(uid: string): Promise<void> {
      await admin.auth().revokeRefreshTokens(uid);
    },
  };
}
