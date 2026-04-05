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

type SocketResult = { ok: true; data: { lobbyId: string } } | { ok: false; error: string };

type GameState = {
  players: Array<{
    userId: string;
    name: string;
    health: number;
    isHost: boolean;
  }>;
  winner?: string | null;
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
  const [gameState, setGameState] = useState<GameState>({ players: [] });
  const [gameMessage, setGameMessage] = useState("");
  const [gameOver, setGameOver] = useState(false);

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
          ? "Match room live. CV gameplay is available below."
          : `Lobby state: ${nextLobby.state}`,
      );

      if (nextLobby.state === "in_game") {
        setGameOver(false);
        setGameMessage("Battle started. Attack the other player!");
        setGameState((current) => {
          if (current.players.length > 0) {
            return current;
          }
          return {
            players: nextLobby.players.map((player) => ({
              userId: player.userId,
              name: formatPlayerName(player),
              health: 100,
              isHost: player.isHost,
            })),
          };
        });
      }
    });

    socket.on("game:state", ({ gameState }: { gameState: GameState }) => {
      setGameState(gameState);
      if (gameState.winner) {
        setGameOver(true);
        const winnerId = gameState.winner;
        const winner = gameState.players.find((player) => player.userId === winnerId);
        const loser = gameState.players.find((player) => player.userId !== winnerId);
        setGameMessage(
          winnerId === user?.id
            ? `You defeated ${loser?.name ?? "the opponent"}!`
            : `You were defeated by ${winner?.name ?? "the opponent"}.`,
        );
      } else {
        setGameOver(false);
      }
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

  useEffect(() => {
    if (!lobby || lobby.state !== "in_game") {
      return;
    }

    setGameState((current) => {
      if (current.players.length === 0 && lobby.players.length > 0) {
        return {
          players: lobby.players.map((player) => ({
            userId: player.userId,
            name: formatPlayerName(player),
            health: 100,
            isHost: player.isHost,
          })),
        };
      }
      return current;
    });
  }, [lobby]);

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
          ? "Match room live. CV gameplay is available below."
          : `Lobby state: ${payload.lobby.state}`,
      );
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError instanceof Error ? loadError.message : "Could not load match room.",
      );
    }
  }

  function handleAttack(targetId: string) {
    if (gameOver) {
      return;
    }

    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError("Unable to send the attack. Socket is not connected.");
      return;
    }

    socket.emit(
      "game:attack",
      { lobbyId, targetUserId: targetId },
      (result: SocketResult) => {
        if (!result.ok) {
          setError(result.error);
        }
      },
    );
  }

  function handlePlayAgain() {
    const socket = socketRef.current;

    if (!socket || !socket.connected) {
      setError("Unable to restart the match. Socket is not connected.");
      return;
    }

    socket.emit(
      "game:restart",
      { lobbyId },
      (result: SocketResult) => {
        if (!result.ok) {
          setError(result.error);
          return;
        }

        setGameMessage("Match restarted. Ready up and attack again!");
      },
    );
  }

  const isHost = lobby?.hostUserId === user?.id;

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
          <p className={styles.label}>Gameplay</p>
          <h2>Match combat</h2>
          <p className={styles.muted}>
            Attack the other player and watch the health bars update in real time.
            This is the new gameplay placeholder attached to the current lobby route.
          </p>

          {lobby?.state !== "in_game" ? (
            <div className={styles.stage}>
              <span>Waiting for the host to start the game...</span>
            </div>
          ) : (
            <div className={styles.gameplay}>
              <div className={styles.healthGrid}>
                {gameState.players.map((player) => {
                  const healthPercent = Math.max(0, Math.min(100, player.health));
                  return (
                    <div key={player.userId} className={styles.healthCard}>
                      <strong>{player.name}</strong>
                      <div className={styles.healthBarBackground}>
                        <div
                          className={styles.healthBarFill}
                          style={{
                            width: `${healthPercent}%`,
                            backgroundColor:
                              healthPercent > 50 ? "#4caf50" : healthPercent > 25 ? "#ff9800" : "#f44336",
                          }}
                        />
                      </div>
                      <p className={styles.muted}>{player.health} HP</p>
                    </div>
                  );
                })}
              </div>

              <div className={styles.attackPanel}>
                <p className={styles.label}>Actions</p>
                {gameOver ? (
                  <>
                    <p className={styles.error}>{gameMessage || "Match finished."}</p>
                    {isHost ? (
                      <button
                        type="button"
                        className={styles.attackButton}
                        onClick={handlePlayAgain}
                      >
                        Play again
                      </button>
                    ) : null}
                  </>
                ) : (
                  gameState.players.length > 0 && (
                    <div className={styles.attackButtons}>
                      {gameState.players
                        .filter((player) => player.userId !== user?.id)
                        .map((player) => (
                          <button
                            key={player.userId}
                            className={styles.attackButton}
                            type="button"
                            onClick={() => handleAttack(player.userId)}
                          >
                            Attack {player.name}
                          </button>
                        ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
