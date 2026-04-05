"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { apiUrl } from "@/lib/api";
import {
  firebaseConfigReady,
  getFirebaseAuth,
  getFirebaseClientSummary,
} from "@/lib/firebase-client";
import { emitSessionUserUpdated } from "@/lib/session-user-events";
import { Skeleton } from "@/components/Skeleton";
import type { AppUser } from "@/lib/types";
import styles from "./page.module.css";

type Mode = "sign-in" | "create-account";

type LeaderboardResponse = {
  leaderboard: AppUser[];
};

type SessionResponse = {
  user: AppUser | null;
};

type HealthResponse = {
  ok: boolean;
  firebase?: {
    mode: "emulator" | "project";
    projectId: string;
    reachable: boolean;
  };
  error?: string;
};

function formatPlayerName(user: AppUser) {
  return user.displayName || user.email || user.firebaseUid;
}

function formatPlayerRank(user: AppUser) {
  return `Level ${user.level} ${user.className} · ${user.xp} XP`;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

function getAuthErrorMessage(error: unknown, mode: Mode) {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  switch (code) {
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return mode === "sign-in"
        ? "No account found for that email. Try registering first."
        : "That player account could not be found.";
    case "auth/email-already-in-use":
      return "That email already has a player account. Switch to Login instead.";
    case "auth/wrong-password":
      return "That password does not match the player account.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/network-request-failed":
      return "Could not connect to the login service. Please try again later.";
    default:
      return error instanceof Error ? error.message : "Authentication failed.";
  }
}

export function LoginForm() {
  const firebaseClientSummary = getFirebaseClientSummary();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; displayName?: string }>({});
  const [status, setStatus] = useState("Ready to sign in.");
  const [user, setUser] = useState<AppUser | null>(null);
  const [leaderboard, setLeaderboard] = useState<AppUser[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [backendFirebaseTarget, setBackendFirebaseTarget] =
    useState<HealthResponse["firebase"] | null>(null);
  const [backendFirebaseError, setBackendFirebaseError] = useState("");

  useEffect(() => {
    void loadSession();
    void loadLeaderboard();
    void loadBackendHealth();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        setUser(null);
        emitSessionUserUpdated(null);
        setStatus("Ready to sign in.");
        return;
      }

      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not load session.");
      }

      setUser(payload.user);
      emitSessionUserUpdated(payload.user);
      setStatus(`Signed in as ${formatPlayerName(payload.user)}.`);
    } catch (loadError) {
      console.error(loadError);
      emitSessionUserUpdated(null);
      setStatus("Game server is unreachable. You can still create an account.");
    }
  }

  async function loadLeaderboard() {
    try {
      const response = await fetch(apiUrl("/api/leaderboard?limit=5"), {
        credentials: "include",
      });
      const payload = await readJson<LeaderboardResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not load leaderboard.");
      }

      setLeaderboard(payload.leaderboard);
    } catch (loadError) {
      console.error(loadError);
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  async function loadBackendHealth() {
    try {
      const response = await fetch(apiUrl("/api/auth/target"), {
        credentials: "include",
      });
      const payload = await readJson<HealthResponse>(response);

      if (payload.firebase) {
        setBackendFirebaseTarget(payload.firebase);
      }

      if (!response.ok || !payload.ok || !payload.firebase) {
        throw new Error(payload.error || "Could not load backend Firebase status.");
      }

      setBackendFirebaseError("");
    } catch (loadError) {
      console.error(loadError);
      setBackendFirebaseError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load backend Firebase status.",
      );
    }
  }

  async function handleGoogleSignIn() {
    if (!firebaseConfigReady()) {
      setError("Login is not configured yet. Please contact the team.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const auth = getFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken(true);
      const response = await fetch(apiUrl("/api/auth/session"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          displayName: credential.user.displayName || null,
        }),
      });
      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not create backend session.");
      }

      setUser(payload.user);
      emitSessionUserUpdated(payload.user);
      setStatus(`Signed in as ${formatPlayerName(payload.user)}.`);
      await loadLeaderboard();
      router.push("/");
    } catch (submitError) {
      const message = getAuthErrorMessage(submitError, "sign-in");

      if (
        !(typeof submitError === "object" && submitError !== null && "code" in submitError)
      ) {
        console.error(submitError);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseConfigReady()) {
      setError("Login is not configured yet. Please contact the team.");
      return;
    }

    const errors: typeof fieldErrors = {};
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "Enter a valid email address.";
    }
    if (password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    if (mode === "create-account" && !displayName.trim()) {
      errors.displayName = "Choose a display name.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    setError("");

    try {
      const auth = getFirebaseAuth();
      const credential =
        mode === "create-account"
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);

      if (mode === "create-account" && displayName.trim()) {
        await updateProfile(credential.user, {
          displayName: displayName.trim(),
        });
      }

      const idToken = await credential.user.getIdToken(true);
      const response = await fetch(apiUrl("/api/auth/session"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
          displayName: displayName.trim() || credential.user.displayName || null,
        }),
      });
      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Unable to finish sign-in because your player profile could not be saved right now.");
      }

      setUser(payload.user);
      emitSessionUserUpdated(payload.user);
      setStatus(`Signed in as ${formatPlayerName(payload.user)}.`);
      router.push("/");
    } catch (submitError) {
      const message = getAuthErrorMessage(submitError, mode);

      if (
        !(
          typeof submitError === "object" &&
          submitError !== null &&
          "code" in submitError
        )
      ) {
        console.error(submitError);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError("");

    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });

      if (firebaseConfigReady()) {
        await signOut(getFirebaseAuth());
      }

      setUser(null);
      emitSessionUserUpdated(null);
      setStatus("Signed out. Ready for another player.");
    } catch (logoutError) {
      console.error(logoutError);
      setError("Logout failed.");
    } finally {
      setLoading(false);
    }
  }

  const frontendTargetLabel =
    firebaseClientSummary.mode === "emulator"
      ? `Auth emulator (${firebaseClientSummary.emulatorUrl})`
      : firebaseClientSummary.projectId
        ? `Firebase project ${firebaseClientSummary.projectId}`
        : "Missing frontend Firebase project config";

  const frontendTargetMeta =
    firebaseClientSummary.mode === "emulator"
      ? "Frontend login is pointed at the local auth emulator."
      : firebaseClientSummary.authDomain
        ? `Auth domain: ${firebaseClientSummary.authDomain}`
        : "Set the Firebase web app env vars to enable remote sign-in.";

  const backendTargetLabel = backendFirebaseTarget
    ? backendFirebaseTarget.mode === "emulator"
      ? "Firebase auth emulator"
      : `Firebase project ${backendFirebaseTarget.projectId}`
    : "Waiting for backend health check...";

  const backendTargetMeta = backendFirebaseTarget
    ? backendFirebaseTarget.reachable
      ? "Backend Firebase auth check succeeded."
      : "Backend Firebase auth check failed."
    : backendFirebaseError || "The backend will report its Firebase target here.";

  const firebaseTargetsMatch = backendFirebaseTarget
    ? backendFirebaseTarget.mode === firebaseClientSummary.mode &&
      backendFirebaseTarget.projectId === firebaseClientSummary.projectId
    : null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelLabel}>Arcanagraph</p>
          <h2>{mode === "sign-in" ? "Sign in" : "Create player"}</h2>
        </div>
        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={mode === "sign-in" ? styles.modeActive : ""}
            onClick={() => setMode("sign-in")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "create-account" ? styles.modeActive : ""}
            onClick={() => setMode("create-account")}
          >
            Register
          </button>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        {mode === "create-account" ? (
          <label className={styles.field}>
            <span>Display name</span>
            <input
              value={displayName}
              onChange={(event) => { setDisplayName(event.target.value); setFieldErrors(e => ({ ...e, displayName: undefined })); }}
              placeholder="ArcaneRival"
              style={fieldErrors.displayName ? { borderColor: '#fca5a5' } : undefined}
            />
            {fieldErrors.displayName ? <small className={styles.fieldError}>{fieldErrors.displayName}</small> : null}
          </label>
        ) : null}

        <label className={styles.field}>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => { setEmail(event.target.value); setFieldErrors(e => ({ ...e, email: undefined })); }}
            type="email"
            autoComplete="email"
            placeholder="mage@example.com"
            style={fieldErrors.email ? { borderColor: '#fca5a5' } : undefined}
          />
          {fieldErrors.email ? <small className={styles.fieldError}>{fieldErrors.email}</small> : null}
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            value={password}
            onChange={(event) => { setPassword(event.target.value); setFieldErrors(e => ({ ...e, password: undefined })); }}
            type="password"
            autoComplete="current-password"
            placeholder="At least 6 characters"
            style={fieldErrors.password ? { borderColor: '#fca5a5' } : undefined}
            minLength={6}
            required
          />
          {fieldErrors.password ? <small className={styles.fieldError}>{fieldErrors.password}</small> : null}
        </label>

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading
            ? "Working..."
            : mode === "sign-in"
              ? "Sign In"
              : "Create Account"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.5)" }}>or</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.18)" }} />
        </div>

        <button
          type="button"
          className={styles.submit}
          style={{ background: "#fff", color: "#333", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}
          disabled={loading}
          onClick={handleGoogleSignIn}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Sign in with Google
          </span>
        </button>
      </form>

      {error ? <p className={styles.error} style={{ textAlign: 'center' }}>{error}</p> : null}

    </div>
  );
}
