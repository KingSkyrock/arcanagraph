"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, apiUrl } from "@/lib/api";
import type { AppUser, Lobby, LobbyPlayer } from "@/lib/types";
import styles from "./page.module.css";

type LobbyResponse = {
  lobby: Lobby;
  error?: string;
};

type SessionResponse = {
  user: AppUser | null;
  error?: string;
};

type SocketResult = { ok: true; data: { lobbyId: string } } | { ok: false; error: string };

function formatPlayerName(player: Pick<LobbyPlayer, "displayName" | "email" | "firebaseUid">) {
  return player.displayName || player.email || player.firebaseUid;
}

function formatPlayerRank(player: Pick<LobbyPlayer, "level" | "className" | "xp">) {
  return `Level ${player.level} ${player.className} · ${player.xp} XP`;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function PlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLobbyId = searchParams.get("lobby");
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [status, setStatus] = useState("Checking your player session...");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = io(apiBaseUrl, {
      withCredentials: true,
      autoConnect: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSocketConnected(true);
      setStatus((currentStatus) =>
        currentStatus.includes("Signed in") ? currentStatus : "Socket connected.",
      );
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setStatus("Socket offline. Reconnecting to lobby updates...");
    });

    socket.on("connect_error", (connectError) => {
      console.error(connectError);
      setSocketConnected(false);
      setError(
        connectError.message
          ? `Unable to connect to the lobby server: ${connectError.message}`
          : "Unable to connect to the lobby server.",
      );
    });

    socket.on("lobby:update", ({ lobby: nextLobby }: { lobby: Lobby }) => {
      setLobby(nextLobby);
      setStatus(
        nextLobby.state === "in_game"
          ? "Match is live."
          : `Lobby ${nextLobby.inviteCode} updated.`,
      );
    });

    socket.on("lobby:error", ({ message }: { message: string }) => {
      setError(message);
    });

    socket.on("game:starting", ({ lobbyId }: { lobbyId: string }) => {
      if (lobbyId === activeLobbyId) {
        setStatus("Everyone is ready. Spinning up the match...");
      }
    });

    socket.on("game:started", ({ lobbyId, route }: { lobbyId: string; route: string }) => {
      if (lobbyId === activeLobbyId) {
        router.push(route);
      }
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [activeLobbyId, router, user]);

  useEffect(() => {
    if (!user || !activeLobbyId) {
      if (!activeLobbyId) {
        setLobby(null);
      }

      return;
    }

    void loadLobby(activeLobbyId);
  }, [activeLobbyId, user]);

  useEffect(() => {
    if (!socketConnected || !user || !activeLobbyId) {
      return;
    }

    void emitLobbyEvent("lobby:join", { lobbyId: activeLobbyId });
  }, [activeLobbyId, socketConnected, user]);

  useEffect(() => {
    if (!lobby || !activeLobbyId) {
      return;
    }

    if (lobby.id === activeLobbyId && lobby.state === "in_game" && lobby.match) {
      router.push(`/game/${lobby.id}`);
    }
  }, [activeLobbyId, lobby, router]);

  async function loadSession() {
    try {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        setUser(null);
        setStatus("Sign in to create or join a lobby.");
        return;
      }

      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not load session.");
      }

      setUser(payload.user);
      setStatus(`Signed in as ${payload.user.displayName || payload.user.email || "player"}.`);
    } catch (loadError) {
      console.error(loadError);
      setStatus("Backend unavailable. Start the frontend, backend, and Postgres first.");
      setError(
        loadError instanceof Error ? loadError.message : "Could not verify your player session.",
      );
    }
  }

  async function loadLobby(lobbyId: string) {
    try {
      const response = await fetch(apiUrl(`/api/lobbies/${lobbyId}`), {
        credentials: "include",
      });
      const payload = await readJson<LobbyResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not load lobby.");
      }

      setLobby(payload.lobby);
      setStatus(`Lobby ${payload.lobby.inviteCode} loaded.`);
    } catch (loadError) {
      console.error(loadError);
      setLobby(null);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load lobby.",
      );
    }
  }

  async function emitLobbyEvent(event: string, payload: Record<string, unknown>) {
    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      return { ok: false, error: "Socket connection is not ready yet." } satisfies SocketResult;
    }

    return await new Promise<SocketResult>((resolve) => {
      socket.emit(event, payload, (result: SocketResult) => {
        resolve(result);
      });
    });
  }

  async function handleCreateLobby() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/api/lobbies"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: {
            mode: "trace-duel",
            curriculum: "default",
          },
        }),
      });
      const payload = await readJson<LobbyResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not create lobby.");
      }

      setLobby(payload.lobby);
      setStatus(`Lobby ${payload.lobby.inviteCode} created.`);
      router.replace(`/play?lobby=${payload.lobby.id}`);

      if (socketConnected) {
        await emitLobbyEvent("lobby:join", { lobbyId: payload.lobby.id });
      }
    } catch (createError) {
      console.error(createError);
      setError(
        createError instanceof Error ? createError.message : "Could not create lobby.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinLobby() {
    if (!socketConnected) {
      setError("Waiting for the realtime lobby connection. Try joining again in a moment.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await emitLobbyEvent("lobby:join", {
        inviteCode: inviteCode.trim().toUpperCase(),
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      await loadLobby(result.data.lobbyId);
      router.replace(`/play?lobby=${result.data.lobbyId}`);
      setInviteCode("");
    } catch (joinError) {
      console.error(joinError);
      setError(joinError instanceof Error ? joinError.message : "Could not join lobby.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReadyToggle() {
    if (!lobby || !user) {
      return;
    }

    const currentPlayer = lobby.players.find((player) => player.userId === user.id);

    if (!currentPlayer) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await emitLobbyEvent("lobby:ready", {
        lobbyId: lobby.id,
        ready: !currentPlayer.ready,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }
    } catch (readyError) {
      console.error(readyError);
      setError(readyError instanceof Error ? readyError.message : "Could not update ready state.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStartGame() {
    if (!lobby) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const result = await emitLobbyEvent("lobby:start", {
        lobbyId: lobby.id,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }
    } catch (startError) {
      console.error(startError);
      setError(startError instanceof Error ? startError.message : "Could not start game.");
    } finally {
      setBusy(false);
    }
  }

  const currentPlayer = user
    ? lobby?.players.find((player) => player.userId === user.id) || null
    : null;
  const allPlayersReady = lobby?.players.every((player) => player.ready) ?? false;
  const isHost = lobby?.hostUserId === user?.id;

  if (!user) {
    return (
      <section className={styles.panel}>
        <p className={styles.label}>Session required</p>
        <h2>Sign in before joining a match.</h2>
        <p className={styles.muted}>
          The new lobby flow is tied to the same Firebase + Express session cookie as the
          leaderboard and progression system.
        </p>
        <Link className={styles.primaryButton} href="/login">
          Go to login
        </Link>
      </section>
    );
  }

  return (
    <section className={styles.layout}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.label}>Matchmaking</p>
            <h2>Create or join</h2>
          </div>
          <span className={styles.connection}>
            {socketConnected ? "Socket online" : "Socket offline"}
          </span>
        </div>

        <div className={styles.actions}>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={handleCreateLobby}
            disabled={busy}
          >
            Create lobby
          </button>

          <div className={styles.joinRow}>
            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
              placeholder="Invite code"
              maxLength={6}
            />
            <button
              type="button"
              onClick={handleJoinLobby}
              disabled={busy || !socketConnected || !inviteCode.trim()}
            >
              Join
            </button>
          </div>
        </div>

        <div className={styles.statusCard}>
          <p className={styles.label}>Status</p>
          <strong>{status}</strong>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.label}>Active lobby</p>
            <h2>{lobby ? lobby.inviteCode : "No lobby selected"}</h2>
          </div>
          {lobby ? <span className={styles.statePill}>{lobby.state}</span> : null}
        </div>

        {lobby ? (
          <>
            <div className={styles.detailGrid}>
              <div className={styles.detailCard}>
                <span>Invite code</span>
                <strong>{lobby.inviteCode}</strong>
              </div>
              <div className={styles.detailCard}>
                <span>Players</span>
                <strong>{lobby.players.length}</strong>
              </div>
              <div className={styles.detailCard}>
                <span>Host</span>
                <strong>{isHost ? "You" : "Another player"}</strong>
              </div>
            </div>

            <div className={styles.controlRow}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleReadyToggle}
                disabled={busy || !currentPlayer || lobby.state !== "waiting"}
              >
                {currentPlayer?.ready ? "Unready" : "Ready up"}
              </button>

              {isHost ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleStartGame}
                  disabled={busy || !allPlayersReady || lobby.state !== "waiting"}
                >
                  Start game
                </button>
              ) : null}

              {lobby.state === "in_game" ? (
                <Link className={styles.secondaryButton} href={`/game/${lobby.id}`}>
                  Open game
                </Link>
              ) : null}
            </div>

            <ol className={styles.roster}>
              {lobby.players.map((player) => (
                <li key={player.userId} className={styles.rosterItem}>
                  <div>
                    <strong>{formatPlayerName(player)}</strong>
                    <small>{formatPlayerRank(player)}</small>
                  </div>
                  <span>
                    {player.isHost ? "Host" : "Player"} · {player.ready ? "Ready" : "Waiting"}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className={styles.muted}>
            Create a lobby or join one with an invite code to bring the multiplayer flow into
            the current app shell.
          </p>
        )}
      </div>
    </section>
  );
}
