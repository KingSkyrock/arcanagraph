"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, apiUrl } from "@/lib/api";
import type { AppUser, Lobby, LobbyPlayer } from "@/lib/types";
import styles from "./page.module.css";

type GameClientProps = {
  lobbyId: string;
};

type LobbyResponse = {
  lobby: Lobby;
  error?: string;
};

type SessionResponse = {
  user: AppUser | null;
  error?: string;
};

function formatPlayerName(player: Pick<LobbyPlayer, "displayName" | "email" | "firebaseUid">) {
  return player.displayName || player.email || player.firebaseUid;
}

function formatPlayerRank(player: Pick<LobbyPlayer, "level" | "className" | "xp">) {
  return `Level ${player.level} ${player.className} · ${player.xp} XP`;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

export function GameClient({ lobbyId }: GameClientProps) {
  const socketRef = useRef<Socket | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [status, setStatus] = useState("Loading match room...");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadSession();
    void loadLobby(lobbyId);
  }, [lobbyId]);

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
      socket.emit("lobby:join", { lobbyId }, () => undefined);
    });

    socket.on("lobby:update", ({ lobby: nextLobby }: { lobby: Lobby }) => {
      if (nextLobby.id !== lobbyId) {
        return;
      }

      setLobby(nextLobby);
      setStatus(
        nextLobby.state === "in_game"
          ? "Match room live. CV gameplay can attach here next."
          : `Lobby state: ${nextLobby.state}`,
      );
    });

    socket.on("lobby:error", ({ message }: { message: string }) => {
      setError(message);
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [lobbyId, user]);

  async function loadSession() {
    try {
      const response = await fetch(apiUrl("/api/auth/me"), {
        credentials: "include",
      });

      if (response.status === 401) {
        setStatus("Sign in to view this match room.");
        return;
      }

      const payload = await readJson<SessionResponse>(response);

      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Could not load session.");
      }

      setUser(payload.user);
    } catch (loadError) {
      console.error(loadError);
      setError("Could not load your session.");
    }
  }

  async function loadLobby(targetLobbyId: string) {
    try {
      const response = await fetch(apiUrl(`/api/lobbies/${targetLobbyId}`), {
        credentials: "include",
      });
      const payload = await readJson<LobbyResponse>(response);

      if (!response.ok) {
        throw new Error(payload.error || "Could not load match room.");
      }

      setLobby(payload.lobby);
      setStatus(
        payload.lobby.state === "in_game"
          ? "Match room live. CV gameplay can attach here next."
          : `Lobby state: ${payload.lobby.state}`,
      );
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load match room.",
      );
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.kicker}>Game Room</p>
          <h1>Match {lobby?.inviteCode || "loading"}</h1>
          <p className={styles.copy}>
            This is the integrated game route inside the current Next app. Your teammate can
            now attach CV drawing, overlays, and realtime match state here without relying on
            the old standalone backend pages app.
          </p>
          <div className={styles.links}>
            <Link className={styles.linkButton} href={`/play?lobby=${lobbyId}`}>
              Back to lobby
            </Link>
            <Link className={styles.linkButton} href="/">
              Home
            </Link>
          </div>
        </div>

        <div className={styles.panel}>
          <p className={styles.label}>Status</p>
          <strong>{status}</strong>
          {error ? <p className={styles.error}>{error}</p> : null}
          {user ? (
            <p className={styles.muted}>
              Signed in as {user.displayName || user.email || user.firebaseUid}
            </p>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.label}>Players</p>
              <h2>{lobby?.players.length || 0} queued</h2>
            </div>
            {lobby ? <span className={styles.state}>{lobby.state}</span> : null}
          </div>

          {lobby ? (
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
          ) : (
            <p className={styles.muted}>Waiting for lobby state from the backend.</p>
          )}
        </div>

        <div className={styles.panel}>
          <p className={styles.label}>CV hook point</p>
          <h2>Gameplay placeholder</h2>
          <p className={styles.muted}>
            Drop the camera feed, overlay traces, and realtime scoring UI into this section.
            The auth, lobby membership, and game route are already inside the main app shell.
          </p>
          <div className={styles.stage}>
            <span>Camera / CV feed</span>
            <span>Shape or equation overlay</span>
            <span>Round timer / score</span>
          </div>
        </div>
      </section>
    </main>
  );
}
