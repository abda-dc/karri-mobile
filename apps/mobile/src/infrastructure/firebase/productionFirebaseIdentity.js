const EXPECTED_PROJECT_ID = "karri-mobile-prod";
const EXPECTED_PROJECT_NUMBER = "432940332748";
const EXPECTED_PACKAGE_ID = "com.karrimobile.app";
const EXPECTED_AUTH_DOMAIN = "karri-mobile-prod.firebaseapp.com";
const EXPECTED_STORAGE_BUCKET = "karri-mobile-prod.firebasestorage.app";

function fail(code) {
  throw new Error(`production-firebase/${code}`);
}

function requireValue(value, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    fail(code);
  }

  return value;
}

function assertExact(value, expected, code) {
  if (value !== expected) {
    fail(code);
  }
}

function assertPattern(value, pattern, code) {
  if (typeof value !== "string" || !pattern.test(value)) {
    fail(code);
  }
}

function readPlistString(plistText, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `<key>\\s*${escapedKey}\\s*</key>\\s*<string>([^<]*)</string>`,
  );
  const match = plistText.match(pattern);

  return match?.[1];
}

function validatePublicConfig(publicConfig) {
  requireValue(publicConfig.apiKey, "public-api-key-missing");

  assertExact(
    publicConfig.projectId,
    EXPECTED_PROJECT_ID,
    "public-project-id-mismatch",
  );
  assertExact(
    publicConfig.messagingSenderId,
    EXPECTED_PROJECT_NUMBER,
    "public-sender-id-mismatch",
  );
  assertExact(
    publicConfig.authDomain,
    EXPECTED_AUTH_DOMAIN,
    "public-auth-domain-mismatch",
  );
  assertExact(
    publicConfig.storageBucket,
    EXPECTED_STORAGE_BUCKET,
    "public-storage-bucket-mismatch",
  );
  assertPattern(
    publicConfig.appId,
    /^1:432940332748:web:[A-Za-z0-9]+$/,
    "public-app-id-mismatch",
  );
}

function validateAndroidConfig(nativeConfigText) {
  let parsed;

  try {
    parsed = JSON.parse(nativeConfigText);
  } catch {
    fail("android-invalid-json");
  }

  assertExact(
    parsed?.project_info?.project_id,
    EXPECTED_PROJECT_ID,
    "android-project-id-mismatch",
  );
  assertExact(
    String(parsed?.project_info?.project_number ?? ""),
    EXPECTED_PROJECT_NUMBER,
    "android-project-number-mismatch",
  );
  assertExact(
    parsed?.project_info?.storage_bucket,
    EXPECTED_STORAGE_BUCKET,
    "android-storage-bucket-mismatch",
  );

  const clients = Array.isArray(parsed?.client) ? parsed.client : [];
  const expectedClient = clients.find(
    (client) =>
      client?.client_info?.android_client_info?.package_name ===
      EXPECTED_PACKAGE_ID,
  );

  if (!expectedClient) {
    fail("android-package-id-mismatch");
  }

  assertPattern(
    expectedClient?.client_info?.mobilesdk_app_id,
    /^1:432940332748:android:[A-Za-z0-9]+$/,
    "android-app-id-mismatch",
  );
}

function validateIosConfig(nativeConfigText) {
  assertExact(
    readPlistString(nativeConfigText, "PROJECT_ID"),
    EXPECTED_PROJECT_ID,
    "ios-project-id-mismatch",
  );
  assertExact(
    readPlistString(nativeConfigText, "GCM_SENDER_ID"),
    EXPECTED_PROJECT_NUMBER,
    "ios-sender-id-mismatch",
  );
  assertExact(
    readPlistString(nativeConfigText, "STORAGE_BUCKET"),
    EXPECTED_STORAGE_BUCKET,
    "ios-storage-bucket-mismatch",
  );
  assertExact(
    readPlistString(nativeConfigText, "BUNDLE_ID"),
    EXPECTED_PACKAGE_ID,
    "ios-bundle-id-mismatch",
  );
  assertPattern(
    readPlistString(nativeConfigText, "GOOGLE_APP_ID"),
    /^1:432940332748:ios:[A-Za-z0-9]+$/,
    "ios-app-id-mismatch",
  );
}

function validateProductionFirebaseIdentity(input) {
  validatePublicConfig(input.publicConfig);

  if (input.platform === "android") {
    validateAndroidConfig(input.nativeConfigText);
    return;
  }

  if (input.platform === "ios") {
    validateIosConfig(input.nativeConfigText);
    return;
  }

  fail("platform-invalid");
}

module.exports = {
  validateProductionFirebaseIdentity,
};
