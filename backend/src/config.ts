import "dotenv/config";

function readString(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function readRequiredString(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback: number) {
  const value = process.env[name];

  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOrigins() {
  return readString("FRONTEND_ORIGIN", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: readNumber("PORT", 4000),
  frontendOrigins: readOrigins(),
  databaseUrl: readRequiredString("DATABASE_URL"),
  sessionCookieName: readString("SESSION_COOKIE_NAME", "arcanagraph_session"),
  sessionExpiresDays: readNumber("SESSION_EXPIRES_DAYS", 5),
  firebaseProjectId: readString("FIREBASE_PROJECT_ID", "arcanagraph-dev"),
  firebaseAuthEmulatorHost: readString("FIREBASE_AUTH_EMULATOR_HOST"),
  firebaseClientEmail: readString("FIREBASE_CLIENT_EMAIL"),
  firebasePrivateKey: readString("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  nodeEnv: readString("NODE_ENV", "development"),
};

export const isProduction = config.nodeEnv === "production";
