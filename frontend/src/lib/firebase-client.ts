import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let emulatorConnected = false;

export type FirebaseClientSummary = {
  mode: "emulator" | "project";
  projectId: string | null;
  authDomain: string | null;
  emulatorUrl: string | null;
};

function usesFirebaseEmulator() {
  return process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
}

export function firebaseConfigReady() {
  return Object.values(firebaseConfig).every(Boolean);
}

export function getFirebaseClientSummary(): FirebaseClientSummary {
  const emulatorUrl =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ||
    "http://127.0.0.1:9099";

  return {
    mode: usesFirebaseEmulator() ? "emulator" : "project",
    projectId: firebaseConfig.projectId || null,
    authDomain: firebaseConfig.authDomain || null,
    emulatorUrl: usesFirebaseEmulator() ? emulatorUrl : null,
  };
}

export function getFirebaseAuth() {
  if (!firebaseConfigReady()) {
    throw new Error("Missing Firebase web config in frontend env vars.");
  }

  const clientSummary = getFirebaseClientSummary();

  if (
    process.env.NODE_ENV === "production" &&
    clientSummary.mode === "emulator"
  ) {
    throw new Error(
      "NEXT_PUBLIC_USE_FIREBASE_EMULATOR must be false or unset in production builds.",
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (!emulatorConnected && clientSummary.mode === "emulator" && clientSummary.emulatorUrl) {
    connectAuthEmulator(auth, clientSummary.emulatorUrl, {
      disableWarnings: true,
    });
    emulatorConnected = true;
  }

  return auth;
}
