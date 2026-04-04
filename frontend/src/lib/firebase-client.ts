import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let emulatorConnected = false;

export function firebaseConfigReady() {
  return Object.values(firebaseConfig).every(Boolean);
}

export function getFirebaseAuth() {
  if (!firebaseConfigReady()) {
    throw new Error("Missing Firebase web config in frontend env vars.");
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);

  if (
    !emulatorConnected &&
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true"
  ) {
    const emulatorUrl =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ||
      "http://127.0.0.1:9099";

    connectAuthEmulator(auth, emulatorUrl, { disableWarnings: true });
    emulatorConnected = true;
  }

  return auth;
}
