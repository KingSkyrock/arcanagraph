import { cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./config";
import { resolveFirebaseAdminRuntime } from "./firebase-runtime";

const firebaseAdminRuntime = resolveFirebaseAdminRuntime({
  firebaseProjectId: config.firebaseProjectId,
  firebaseAuthEmulatorHost: config.firebaseAuthEmulatorHost,
  firebaseClientEmail: config.firebaseClientEmail,
  firebasePrivateKey: config.firebasePrivateKey,
  firebaseServiceAccountJson: config.firebaseServiceAccountJson,
  firebaseServiceAccountJsonBase64: config.firebaseServiceAccountJsonBase64,
  googleApplicationCredentialsPath: config.googleApplicationCredentialsPath,
  nodeEnv: config.nodeEnv,
});

if (firebaseAdminRuntime.emulatorHost) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = firebaseAdminRuntime.emulatorHost;
}

const appOptions: AppOptions = firebaseAdminRuntime.serviceAccount
  ? {
      credential: cert({
        projectId: firebaseAdminRuntime.serviceAccount.projectId,
        clientEmail: firebaseAdminRuntime.serviceAccount.clientEmail,
        privateKey: firebaseAdminRuntime.serviceAccount.privateKey,
      }),
      projectId: firebaseAdminRuntime.projectId,
    }
  : {
      projectId: firebaseAdminRuntime.projectId,
    };

const app =
  getApps()[0] ||
  initializeApp(appOptions);

export const adminAuth = getAuth(app);

export function getFirebaseAdminSummary() {
  return {
    mode: firebaseAdminRuntime.mode,
    projectId: firebaseAdminRuntime.projectId,
    credentialSource: firebaseAdminRuntime.credentialSource,
    emulatorHost: firebaseAdminRuntime.emulatorHost,
  };
}

function isFirebaseUserNotFoundError(error: unknown) {
  const maybeCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  return maybeCode === "auth/user-not-found";
}

export async function pingFirebaseAdmin() {
  try {
    await adminAuth.getUser("arcanagraph-firebase-target-check");
  } catch (error) {
    if (isFirebaseUserNotFoundError(error)) {
      return;
    }

    throw error;
  }
}
