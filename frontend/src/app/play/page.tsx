"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, apiUrl } from "@/lib/api";
import type { AppUser } from "@/lib/types";

type SessionResponse = {
  user: AppUser | null;
  error?: string;
};

type CreateLobbyResponse = {
  lobby: {
    id: string;
    inviteCode: string;
  };
  error?: string;
};

type SocketResult = { ok: true; data: { lobbyId: string } } | { ok: false; error: string };

async function readJson<T>(response: Response) {
  return (await response.json()) as T & { error?: string };
}

export default function PlayPage() {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState("Checking session...");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        setUser(null);
        setStatus("Sign in first to create or join a lobby.");
        return;
      }

      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not load session.");
      }

      setUser(payload.user);
      setStatus(`Signed in as ${payload.user.displayName || payload.user.email || payload.user.firebaseUid}`);
    } catch (loadError) {
      console.error(loadError);
      setStatus("Unable to verify session. Check backend or auth state.");
    }
  }

  async function handleCreateLobby() {
    if (!user) {
      setError("You must sign in first.");
      return;
    }

    setError("");
    setIsCreating(true);

    try {
      const response = await fetch(apiUrl("/api/lobbies"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = await readJson<CreateLobbyResponse>(response);

      if (!response.ok || !payload.lobby) {
        throw new Error(payload.error || "Could not create lobby.");
      }

      router.push(`/game/${payload.lobby.id}`);
    } catch (createError) {
      console.error(createError);
      setError(createError instanceof Error ? createError.message : "Failed to create lobby.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleJoinLobby() {
    if (!user) {
      setError("You must sign in first.");
      return;
    }

    if (!inviteCode.trim()) {
      setError("Enter an invite code to join a lobby.");
      return;
    }

    setError("");
    setIsJoining(true);

    const socket = io(apiBaseUrl, {
      withCredentials: true,
      autoConnect: false,
    });

    socket.on("connect", () => {
      socket.emit("lobby:join", { inviteCode }, (result: SocketResult) => {
        if (!result.ok) {
          setError(result.error);
          setIsJoining(false);
          socket.disconnect();
          return;
        }

        router.push(`/game/${result.data.lobbyId}`);
      });
    });

    socket.on("connect_error", (connectError) => {
      console.error(connectError);
      setError("Unable to connect to the lobby server.");
      setIsJoining(false);
    });

    socket.connect();
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1>Lobby Center</h1>
      <p>{status}</p>
      {error ? <p style={{ color: "#d32f2f" }}>{error}</p> : null}
      {user ? (
        <div style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <section style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "10px" }}>
            <h2>Create a new lobby</h2>
            <p>Create a fresh lobby and start the match once other players join.</p>
            <button onClick={handleCreateLobby} disabled={isCreating}>
              {isCreating ? "Creating lobby…" : "Create lobby"}
            </button>
          </section>

          <section style={{ border: "1px solid #ccc", padding: "1rem", borderRadius: "10px" }}>
            <h2>Join by invite code</h2>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              Invite code
              <input
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                placeholder="ENTERCODE"
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.5rem" }}
              />
            </label>
            <button onClick={handleJoinLobby} disabled={isJoining}>
              {isJoining ? "Joining…" : "Join lobby"}
            </button>
          </section>

          <Link href="/">Back to home</Link>
        </div>
      ) : (
        <div style={{ marginTop: "1.5rem" }}>
          <p>Sign in first to create or join a lobby.</p>
          <Link href="/login">Go to login</Link>
        </div>
      )}
    </main>
  );
}
