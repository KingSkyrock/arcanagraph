import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { config } from "./config";

if (config.firebaseAuthEmulatorHost) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = config.firebaseAuthEmulatorHost;
}

const app =
  getApps()[0] ||
  initializeApp(
    config.firebaseClientEmail && config.firebasePrivateKey
      ? {
          credential: cert({
            projectId: config.firebaseProjectId,
            clientEmail: config.firebaseClientEmail,
            privateKey: config.firebasePrivateKey,
          }),
          projectId: config.firebaseProjectId,
        }
      : {
          projectId: config.firebaseProjectId,
        },
  );

export const adminAuth = getAuth(app);
