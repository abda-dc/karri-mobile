import admin from "firebase-admin";
import {
  DEVELOPMENT_PROJECT_ID,
  type CallableClient,
  type CallableResponse,
  type IdentityToolkitClient,
  type PlaceHoldPayload,
  runPlaceAdministrativeHoldSmoke,
  type SmokeAuthClient,
  type SmokeFirestoreClient,
} from "./PlaceAdministrativeHoldSmoke.js";

function initializeAdmin(): typeof admin {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: DEVELOPMENT_PROJECT_ID,
    });
  }
  return admin;
}

class FirebaseAdminSmokeAuthClient implements SmokeAuthClient {
  constructor(private readonly auth: admin.auth.Auth) {}

  async createUser(uid: string): Promise<void> {
    await this.auth.createUser({ uid, disabled: false });
  }

  async getUser(uid: string): Promise<{ uid: string } | null> {
    try {
      const user = await this.auth.getUser(uid);
      return { uid: user.uid };
    } catch (error: any) {
      if (error?.code === "auth/user-not-found") {
        return null;
      }
      throw error;
    }
  }

  async setCustomClaims(uid: string, claims: Record<string, unknown> | null): Promise<void> {
    await this.auth.setCustomUserClaims(uid, claims);
  }

  async revokeRefreshTokens(uid: string): Promise<void> {
    await this.auth.revokeRefreshTokens(uid);
  }

  async deleteUser(uid: string): Promise<void> {
    await this.auth.deleteUser(uid);
  }

  async createCustomToken(uid: string): Promise<string> {
    return await this.auth.createCustomToken(uid);
  }
}

class FirestoreSmokeClient implements SmokeFirestoreClient {
  constructor(
    private readonly db: admin.firestore.Firestore,
    private readonly firestoreNamespace: typeof admin.firestore
  ) {}

  async setShipment(shipmentId: string, data: Record<string, unknown>): Promise<void> {
    await this.db.collection("shipments").doc(shipmentId).set(this.toFirestoreTimestamps(data) as admin.firestore.DocumentData);
  }

  async getShipment(shipmentId: string): Promise<Record<string, unknown> | null> {
    return await this.getDoc("shipments", shipmentId);
  }

  async getAdministrativeHold(holdId: string): Promise<Record<string, unknown> | null> {
    return await this.getDoc("administrativeHolds", holdId);
  }

  async getAuditLog(auditId: string): Promise<Record<string, unknown> | null> {
    return await this.getDoc("auditLogs", auditId);
  }

  async countAdministrativeHoldsByShipment(shipmentId: string): Promise<number> {
    const snapshot = await this.db.collection("administrativeHolds").where("shipmentId", "==", shipmentId).get();
    return snapshot.size;
  }

  async countAuditLogsByOperation(action: string, targetType: string, targetId: string, idempotencyKey: string): Promise<number> {
    const snapshot = await this.db.collection("auditLogs")
      .where("targetId", "==", targetId)
      .get();
    return snapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.action === action &&
        data.targetType === targetType &&
        data.idempotencyKey === idempotencyKey;
    }).length;
  }

  async deleteShipment(shipmentId: string): Promise<void> {
    await this.db.collection("shipments").doc(shipmentId).delete();
  }

  async deleteAdministrativeHold(holdId: string): Promise<void> {
    await this.db.collection("administrativeHolds").doc(holdId).delete();
  }

  async deleteAuditLog(auditId: string): Promise<void> {
    await this.db.collection("auditLogs").doc(auditId).delete();
  }

  private async getDoc(collection: string, id: string): Promise<Record<string, unknown> | null> {
    const snapshot = await this.db.collection(collection).doc(id).get();
    return snapshot.exists ? snapshot.data() || null : null;
  }

  private toFirestoreTimestamps(value: unknown): unknown {
    if (value instanceof Date) {
      return this.firestoreNamespace.Timestamp.fromDate(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.toFirestoreTimestamps(item));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, this.toFirestoreTimestamps(item)])
      );
    }
    return value;
  }
}

class FirebaseIdentityToolkitClient implements IdentityToolkitClient {
  async exchangeCustomToken(customToken: string, apiKey: string): Promise<string> {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    });
    const body = await response.json() as { idToken?: string; error?: { message?: string } };
    if (!response.ok || !body.idToken) {
      throw new Error(`Identity Toolkit token exchange failed: ${body.error?.message || response.statusText}`);
    }
    return body.idToken;
  }
}

class DeployedCallableClient implements CallableClient {
  async callPlaceAdministrativeHold(idToken: string, payload: PlaceHoldPayload): Promise<CallableResponse> {
    const response = await fetch(`https://us-east1-${DEVELOPMENT_PROJECT_ID}.cloudfunctions.net/placeAdministrativeHold`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });
    const body = await response.json().catch(() => ({})) as {
      result?: unknown;
      error?: { status?: string; message?: string };
    };
    if (body.error) {
      return {
        ok: false,
        status: body.error.status || response.statusText,
        message: body.error.message,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.statusText || `HTTP_${response.status}`,
      };
    }
    return {
      ok: true,
      result: body.result as any,
    };
  }
}

async function main(): Promise<number> {
  try {
    const firebaseAdmin = initializeAdmin();
    const result = await runPlaceAdministrativeHoldSmoke(process.env, {
      auth: new FirebaseAdminSmokeAuthClient(firebaseAdmin.auth()),
      firestore: new FirestoreSmokeClient(firebaseAdmin.firestore(), firebaseAdmin.firestore),
      identityToolkit: new FirebaseIdentityToolkitClient(),
      callable: new DeployedCallableClient(),
    });
    console.log(`Live callable smoke succeeded for run ${result.runId}.`);
    console.log(`Verified shipment ${result.shipmentId}, hold ${result.holdId}, and audit log ${result.auditId}.`);
    console.log("Cleanup completed.");
    return 0;
  } catch (error: any) {
    console.error(`Live callable smoke failed: ${error.message || error}`);
    return 1;
  }
}

main().then((code) => {
  process.exit(code);
});
