import assert from "node:assert/strict";
import test from "node:test";
import { resolveFirebaseAdminRuntime } from "./firebase-runtime";

function createConfig(overrides: Partial<Parameters<typeof resolveFirebaseAdminRuntime>[0]> = {}) {
  return {
    firebaseProjectId: "arcanagraph-prod",
    firebaseAuthEmulatorHost: "",
    firebaseClientEmail: "",
    firebasePrivateKey: "",
    firebaseServiceAccountJson: "",
    firebaseServiceAccountJsonBase64: "",
    googleApplicationCredentialsPath: "",
    nodeEnv: "development",
    ...overrides,
  };
}

test("resolveFirebaseAdminRuntime accepts a base64 encoded service account json", () => {
  const serviceAccountJson = JSON.stringify({
    project_id: "arcanagraph-live",
    client_email: "firebase-adminsdk@example.com",
    private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
  });

  const runtime = resolveFirebaseAdminRuntime(
    createConfig({
      firebaseServiceAccountJsonBase64: Buffer.from(serviceAccountJson).toString("base64"),
    }),
  );

  assert.equal(runtime.mode, "project");
  assert.equal(runtime.projectId, "arcanagraph-live");
  assert.equal(runtime.credentialSource, "service-account-json-base64");
  assert.equal(runtime.serviceAccount?.clientEmail, "firebase-adminsdk@example.com");
});

test("resolveFirebaseAdminRuntime rejects partial firebase admin env pairs", () => {
  assert.throws(
    () =>
      resolveFirebaseAdminRuntime(
        createConfig({
          firebaseClientEmail: "firebase-adminsdk@example.com",
        }),
      ),
    /Set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY/,
  );
});

test("resolveFirebaseAdminRuntime rejects emulator mode in production", () => {
  assert.throws(
    () =>
      resolveFirebaseAdminRuntime(
        createConfig({
          firebaseAuthEmulatorHost: "127.0.0.1:9099",
          nodeEnv: "production",
        }),
      ),
    /FIREBASE_AUTH_EMULATOR_HOST must be unset when NODE_ENV=production/,
  );
});

test("resolveFirebaseAdminRuntime requires real credentials in production project mode", () => {
  assert.throws(
    () =>
      resolveFirebaseAdminRuntime(
        createConfig({
          nodeEnv: "production",
        }),
      ),
    /Production Firebase admin credentials are missing/,
  );
});

test("resolveFirebaseAdminRuntime allows application default credentials in production", () => {
  const runtime = resolveFirebaseAdminRuntime(
    createConfig({
      nodeEnv: "production",
      googleApplicationCredentialsPath: "/etc/secrets/firebase.json",
    }),
  );

  assert.equal(runtime.mode, "project");
  assert.equal(runtime.credentialSource, "application-default");
  assert.equal(runtime.projectId, "arcanagraph-prod");
});

test("resolveFirebaseAdminRuntime requires FIREBASE_PROJECT_ID with GOOGLE_APPLICATION_CREDENTIALS", () => {
  assert.throws(
    () =>
      resolveFirebaseAdminRuntime(
        createConfig({
          firebaseProjectId: "",
          googleApplicationCredentialsPath: "/etc/secrets/firebase.json",
        }),
      ),
    /FIREBASE_PROJECT_ID is required when using GOOGLE_APPLICATION_CREDENTIALS/,
  );
});
