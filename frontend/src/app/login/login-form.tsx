"use client";

import { useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { apiUrl } from "@/lib/api";
import { firebaseConfigReady, getFirebaseAuth } from "@/lib/firebase-client";
import type { AppUser } from "@/lib/types";
import styles from "./page.module.css";

type Mode = "sign-in" | "create-account";

type LeaderboardResponse = {
  leaderboard: AppUser[];
};

type SessionResponse = {
  user: AppUser | null;
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
        ? "No player exists for that email in the current Firebase auth target. Use Register first, or make sure you're signing into the same emulator/project."
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
      return "Could not reach Firebase. Make sure the auth emulator or project is running.";
    default:
      return error instanceof Error ? error.message : "Authentication failed.";
  }
}

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Checking backend session...");
  const [user, setUser] = useState<AppUser | null>(null);
  const [leaderboard, setLeaderboard] = useState<AppUser[]>([]);

  useEffect(() => {
    void loadSession();
    void loadLeaderboard();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        setUser(null);
        setStatus("No active match session yet.");
        return;
      }

      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not load session.");
      }

      setUser(payload.user);
      setStatus(`Signed in as ${formatPlayerName(payload.user)}.`);
    } catch (loadError) {
      console.error(loadError);
      setStatus("Backend unavailable. Start Express and Postgres first.");
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
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseConfigReady()) {
      setError("Missing Firebase frontend env vars.");
      return;
    }

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
        throw new Error(payload.error || "Could not create backend session.");
      }

      setUser(payload.user);
      setStatus(`Signed in as ${formatPlayerName(payload.user)}.`);
      await loadLeaderboard();
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
      setStatus("Signed out. Ready for another player.");
    } catch (logoutError) {
      console.error(logoutError);
      setError("Logout failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <p className={styles.panelLabel}>Firebase + Express</p>
          <h2>{mode === "sign-in" ? "Sign in" : "Create player"}</h2>
        </div>
        <div className={styles.modeSwitch}>
          <button
            type="button"
            className={mode === "sign-in" ? styles.modeActive : undefined}
            onClick={() => setMode("sign-in")}
          >
            Login
          </button>
          <button
            type="button"
            className={mode === "create-account" ? styles.modeActive : undefined}
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
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="ArcaneRival"
            />
          </label>
        ) : null}

        <label className={styles.field}>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder="mage@example.com"
            required
          />
        </label>

        <label className={styles.field}>
          <span>Password</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="At least 6 characters"
            minLength={6}
            required
          />
        </label>

        <button className={styles.submit} type="submit" disabled={loading}>
          {loading
            ? "Working..."
            : mode === "sign-in"
              ? "Start Session"
              : "Create Account"}
        </button>
      </form>

      <div className={styles.statusCard}>
        <p className={styles.statusLabel}>Session</p>
        <strong>{status}</strong>
        {user ? (
          <div className={styles.record}>
            <div className={styles.recordBlock}>
              <span>{formatPlayerName(user)}</span>
              <small>{formatPlayerRank(user)}</small>
            </div>
            <div className={styles.recordBlock}>
              <span>
                {user.wins}W / {user.losses}L / {user.gamesPlayed} GP
              </span>
            </div>
          </div>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}
        {user ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleLogout}
            disabled={loading}
          >
            Sign out
          </button>
        ) : null}
      </div>

      <div className={styles.leaderboard}>
        <div className={styles.leaderboardHeader}>
          <p className={styles.panelLabel}>Leaderboard</p>
          <span>Rank / XP / Record</span>
        </div>

        {leaderboard.length ? (
          <ol className={styles.leaderboardList}>
            {leaderboard.map((entry, index) => (
              <li key={entry.id} className={styles.leaderboardItem}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div className={styles.leaderboardMeta}>
                  <strong>{formatPlayerName(entry)}</strong>
                  <small>{formatPlayerRank(entry)}</small>
                </div>
                <span>
                  {entry.wins} / {entry.losses} / {entry.gamesPlayed}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyState}>
            No players yet. Create one locally and the leaderboard will start
            filling in.
          </p>
        )}
      </div>
    </div>
  );
}
