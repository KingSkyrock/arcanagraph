export type FirebaseAdminMode = "emulator" | "project";

export type FirebaseCredentialSource =
  | "service-account-json"
  | "service-account-json-base64"
  | "service-account-env"
  | "application-default"
  | "project-id-only";

export type FirebaseRuntimeConfig = {
  firebaseProjectId: string;
  firebaseAuthEmulatorHost: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
  firebaseServiceAccountJson: string;
  firebaseServiceAccountJsonBase64: string;
  googleApplicationCredentialsPath: string;
  nodeEnv: string;
};

export type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export type FirebaseAdminRuntime = {
  mode: FirebaseAdminMode;
  projectId: string;
  credentialSource: FirebaseCredentialSource;
  emulatorHost: string | null;
  serviceAccount: FirebaseServiceAccount | null;
};

type ParsedServiceAccount = FirebaseServiceAccount & {
  source: Extract<
    FirebaseCredentialSource,
    "service-account-json" | "service-account-json-base64" | "service-account-env"
  >;
};

function parseServiceAccountJson(
  rawJson: string,
  fallbackProjectId: string,
  source: ParsedServiceAccount["source"],
) {
  let parsed: {
    project_id?: unknown;
    client_email?: unknown;
    private_key?: unknown;
  };

  try {
    parsed = JSON.parse(rawJson) as typeof parsed;
  } catch (error) {
    throw new Error(
      `${source === "service-account-json-base64" ? "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64" : "FIREBASE_SERVICE_ACCOUNT_JSON"} must contain valid JSON.`,
    );
  }

  const projectId =
    typeof parsed.project_id === "string" && parsed.project_id.trim()
      ? parsed.project_id.trim()
      : fallbackProjectId;
  const clientEmail =
    typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
  const privateKey =
    typeof parsed.private_key === "string" ? parsed.private_key.trim() : "";

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      `${source === "service-account-json-base64" ? "FIREBASE_SERVICE_ACCOUNT_JSON_BASE64" : "FIREBASE_SERVICE_ACCOUNT_JSON"} must include project_id, client_email, and private_key.`,
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    source,
  } satisfies ParsedServiceAccount;
}

function resolveServiceAccount(config: FirebaseRuntimeConfig) {
  if (config.firebaseServiceAccountJsonBase64) {
    const decodedJson = Buffer.from(
      config.firebaseServiceAccountJsonBase64,
      "base64",
    ).toString("utf8");

    return parseServiceAccountJson(
      decodedJson,
      config.firebaseProjectId,
      "service-account-json-base64",
    );
  }

  if (config.firebaseServiceAccountJson) {
    return parseServiceAccountJson(
      config.firebaseServiceAccountJson,
      config.firebaseProjectId,
      "service-account-json",
    );
  }

  const hasClientEmail = Boolean(config.firebaseClientEmail);
  const hasPrivateKey = Boolean(config.firebasePrivateKey);

  if (hasClientEmail !== hasPrivateKey) {
    throw new Error(
      "Set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or use FIREBASE_SERVICE_ACCOUNT_JSON / FIREBASE_SERVICE_ACCOUNT_JSON_BASE64.",
    );
  }

  if (!hasClientEmail || !hasPrivateKey) {
    return null;
  }

  if (!config.firebaseProjectId) {
    throw new Error(
      "FIREBASE_PROJECT_ID is required when using FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }

  return {
    projectId: config.firebaseProjectId,
    clientEmail: config.firebaseClientEmail,
    privateKey: config.firebasePrivateKey,
    source: "service-account-env",
  } satisfies ParsedServiceAccount;
}

export function resolveFirebaseAdminRuntime(
  config: FirebaseRuntimeConfig,
): FirebaseAdminRuntime {
  const serviceAccount = resolveServiceAccount(config);
  const mode: FirebaseAdminMode = config.firebaseAuthEmulatorHost ? "emulator" : "project";
  const projectId = serviceAccount?.projectId || config.firebaseProjectId;

  if (
    mode === "project" &&
    config.googleApplicationCredentialsPath &&
    !config.firebaseProjectId
  ) {
    throw new Error(
      "FIREBASE_PROJECT_ID is required when using GOOGLE_APPLICATION_CREDENTIALS so the backend targets the correct Firebase project.",
    );
  }

  if (!projectId) {
    throw new Error(
      "Firebase project id is missing. Set FIREBASE_PROJECT_ID or include project_id in the Firebase service account JSON.",
    );
  }

  if (mode === "emulator" && config.nodeEnv === "production") {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST must be unset when NODE_ENV=production. The backend is still pointed at the Firebase Auth emulator.",
    );
  }

  if (
    mode === "project" &&
    config.nodeEnv === "production" &&
    !serviceAccount &&
    !config.googleApplicationCredentialsPath
  ) {
    throw new Error(
      "Production Firebase admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }

  return {
    mode,
    projectId,
    credentialSource: serviceAccount?.source
      ? serviceAccount.source
      : config.googleApplicationCredentialsPath
        ? "application-default"
        : "project-id-only",
    emulatorHost: config.firebaseAuthEmulatorHost || null,
    serviceAccount: serviceAccount
      ? {
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
        }
      : null,
  };
}
