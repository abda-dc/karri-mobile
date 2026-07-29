import { describe, expect, it } from "vitest";

interface ProductionFirebasePublicConfig {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  messagingSenderId?: string;
  projectId?: string;
  storageBucket?: string;
}

const { validateProductionFirebaseIdentity } = require(
  "./productionFirebaseIdentity.js",
) as {
  validateProductionFirebaseIdentity: (input: {
    platform: "android" | "ios";
    nativeConfigText: string;
    publicConfig: ProductionFirebasePublicConfig;
  }) => void;
};

const validPublicConfig: ProductionFirebasePublicConfig = {
  apiKey: "synthetic-api-key",
  appId: "1:432940332748:web:synthetic123",
  authDomain: "karri-mobile-prod.firebaseapp.com",
  messagingSenderId: "432940332748",
  projectId: "karri-mobile-prod",
  storageBucket: "karri-mobile-prod.firebasestorage.app",
};

const validAndroidConfig = JSON.stringify({
  project_info: {
    project_number: "432940332748",
    project_id: "karri-mobile-prod",
    storage_bucket: "karri-mobile-prod.firebasestorage.app",
  },
  client: [
    {
      client_info: {
        mobilesdk_app_id: "1:432940332748:android:synthetic123",
        android_client_info: {
          package_name: "com.karrimobile.app",
        },
      },
    },
  ],
});

const validIosConfig = `
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
  <key>PROJECT_ID</key>
  <string>karri-mobile-prod</string>
  <key>GCM_SENDER_ID</key>
  <string>432940332748</string>
  <key>STORAGE_BUCKET</key>
  <string>karri-mobile-prod.firebasestorage.app</string>
  <key>BUNDLE_ID</key>
  <string>com.karrimobile.app</string>
  <key>GOOGLE_APP_ID</key>
  <string>1:432940332748:ios:synthetic123</string>
</dict>
</plist>
`;

describe("validateProductionFirebaseIdentity", () => {
  it("accepts the expected Android production identity", () => {
    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "android",
        nativeConfigText: validAndroidConfig,
        publicConfig: validPublicConfig,
      }),
    ).not.toThrow();
  });

  it("accepts the expected iOS production identity", () => {
    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "ios",
        nativeConfigText: validIosConfig,
        publicConfig: validPublicConfig,
      }),
    ).not.toThrow();
  });

  it("rejects a development Android project without exposing values", () => {
    const developmentConfig = validAndroidConfig.replace(
      "karri-mobile-prod",
      "karri-mobile-dev",
    );

    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "android",
        nativeConfigText: developmentConfig,
        publicConfig: validPublicConfig,
      }),
    ).toThrow("production-firebase/android-project-id-mismatch");
  });

  it("rejects a development iOS project without exposing values", () => {
    const developmentConfig = validIosConfig.replace(
      "karri-mobile-prod",
      "karri-mobile-dev",
    );

    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "ios",
        nativeConfigText: developmentConfig,
        publicConfig: validPublicConfig,
      }),
    ).toThrow("production-firebase/ios-project-id-mismatch");
  });

  it("rejects a mismatched public Firebase project", () => {
    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "android",
        nativeConfigText: validAndroidConfig,
        publicConfig: {
          ...validPublicConfig,
          projectId: "karri-mobile-dev",
        },
      }),
    ).toThrow("production-firebase/public-project-id-mismatch");
  });

  it("rejects a missing public API key", () => {
    expect(() =>
      validateProductionFirebaseIdentity({
        platform: "ios",
        nativeConfigText: validIosConfig,
        publicConfig: {
          ...validPublicConfig,
          apiKey: undefined,
        },
      }),
    ).toThrow("production-firebase/public-api-key-missing");
  });

  it("never includes supplied configuration values in validation errors", () => {
    const sentinel = "SECRET_SENTINEL_FIREBASE_CONFIG";

    try {
      validateProductionFirebaseIdentity({
        platform: "android",
        nativeConfigText: validAndroidConfig,
        publicConfig: {
          ...validPublicConfig,
          authDomain: sentinel,
        },
      });

      expect.fail("Expected validation to fail.");
    } catch (error) {
      expect(String(error)).not.toContain(sentinel);
    }
  });
});
