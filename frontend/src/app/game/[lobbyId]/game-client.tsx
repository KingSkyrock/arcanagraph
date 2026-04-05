"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, apiUrl } from "@/lib/api";
import type {
  AppUser,
  Lobby,
  LobbyMatch,
  LobbyPlayer,
  MatchPlayer,
} from "@/lib/types";
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

function formatPlayerName(player: Pick<LobbyPlayer, "displayName" | "email" | "firebaseUid">) {
  return player.displayName || player.email || player.firebaseUid;
}

function formatPlayerRank(player: Pick<LobbyPlayer, "level" | "className" | "xp">) {
  return `Level ${player.level} ${player.className} · ${player.xp} XP`;
}

function readJson<T>(response: Response) {
  return response.json() as Promise<T>;
}

function getMatchPlayer(match: LobbyMatch | null, userId: string) {
  return match?.players.find((player) => player.userId === userId) ?? null;
}

function getHealthPercent(match: LobbyMatch | null, player: MatchPlayer | null) {
  if (!match || !player) {
    return 0;
  }

  return Math.max(0, Math.min(100, (player.health / match.maxHealth) * 100));
}

function getPlayerNameById(players: LobbyPlayer[], userId: string | null | undefined) {
  if (!userId) {
    return "Unknown player";
  }

  const player = players.find((entry) => entry.userId === userId);
  return player ? formatPlayerName(player) : "Unknown player";
}

function getResultMessage(lobby: Lobby, currentUserId: string | null) {
  const winnerUserId = lobby.match?.winnerUserId ?? null;

  if (!winnerUserId) {
    return "The match ended without a winner.";
  }

  if (winnerUserId === currentUserId) {
    return "You won the match.";
  }

  return `${getPlayerNameById(lobby.players, winnerUserId)} won the match.`;
}

function getStatusMessage(lobby: Lobby | null, currentUserId: string | null) {
  if (!lobby) {
    return "Loading match room...";
  }

  if (!lobby.match) {
    return lobby.state === "in_game"
      ? "Match state is loading..."
      : `Lobby state: ${lobby.state}`;
  }

  if (lobby.match.status === "finished") {
    return getResultMessage(lobby, currentUserId);
  }

  const currentMatchPlayer = currentUserId ? getMatchPlayer(lobby.match, currentUserId) : null;

  if (currentMatchPlayer && currentMatchPlayer.health <= 0) {
    return "You have been eliminated. Watch the remaining duel play out.";
  }

  return "Choose an opponent and cast damage.";
}

function getLastActionMessage(lobby: Lobby | null) {
  const action = lobby?.match?.lastAction;

  if (!action) {
    return "";
  }

  const attackerName = getPlayerNameById(lobby?.players ?? [], action.attackerUserId);
  const targetName = getPlayerNameById(lobby?.players ?? [], action.targetUserId);
  const defeatSuffix = action.targetDefeated ? " and knocked them out" : "";

  return `${attackerName} hit ${targetName} for ${action.damage} damage${defeatSuffix}.`;
}

function getPlayerOutcomeLabel(
  lobby: Lobby,
  player: LobbyPlayer,
  matchPlayer: MatchPlayer | null,
  currentUserId: string | null,
) {
  if (!lobby.match || !matchPlayer) {
    return player.ready ? "Ready" : "Waiting";
  }

  if (lobby.match.status === "finished" && lobby.match.winnerUserId === player.userId) {
    return player.userId === currentUserId ? "Winner" : "Won";
  }

  if (matchPlayer.health <= 0) {
    return player.userId === currentUserId ? "Defeated" : "Eliminated";
  }

  return player.userId === currentUserId ? "Your turn" : "Targetable";
}

export function GameClient({ lobbyId }: GameClientProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [status, setStatus] = useState("Loading match room...");
  const [error, setError] = useState("");
  const [attackingTargetId, setAttackingTargetId] = useState<string | null>(null);
  const [restartingMatch, setRestartingMatch] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch(apiUrl("/api/auth/me"), {
          credentials: "include",
        });

        if (response.status === 401) {
          if (!cancelled) {
            setStatus("Sign in to view this match room.");
          }

          return;
        }

        const payload = await readJson<SessionResponse>(response);

        if (!response.ok || !payload.user) {
          throw new Error(payload.error || "Could not load session.");
        }

        if (!cancelled) {
          setError("");
          setUser(payload.user);
        }
      } catch (loadError) {
        console.error(loadError);

        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load your session.",
          );
        }
      }
    };

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadLobby = async () => {
      try {
        const response = await fetch(apiUrl(`/api/lobbies/${lobbyId}`), {
          credentials: "include",
        });
        const payload = await readJson<LobbyResponse>(response);

        if (!response.ok) {
          throw new Error(payload.error || "Could not load match room.");
        }

        if (!cancelled) {
          setError("");
          setLobby(payload.lobby);
        }
      } catch (loadError) {
        console.error(loadError);

        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "Could not load match room.",
          );
        }
      }
    };

    void loadLobby();

    return () => {
      cancelled = true;
    };
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
      setSocketConnected(true);
      socket.emit("lobby:join", { lobbyId }, () => undefined);
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setStatus((currentStatus) =>
        currentStatus.includes("won") || currentStatus.includes("eliminated")
          ? currentStatus
          : "Socket offline. Reconnecting to live match updates...",
      );
    });

    socket.on("lobby:update", ({ lobby: nextLobby }: { lobby: Lobby }) => {
      setLobby(nextLobby);
      setStatus(getStatusMessage(nextLobby, user.id));
      setError("");
      setAttackingTargetId(null);
      setRestartingMatch(false);
    });

    socket.on("lobby:error", ({ message }: { message: string }) => {
      setError(message);
      setAttackingTargetId(null);
      setRestartingMatch(false);
    });

    socket.on("game:restarted", ({ lobbyId: restartedLobbyId, route }: { lobbyId: string; route: string }) => {
      if (restartedLobbyId !== lobbyId) {
        return;
      }

      setRestartingMatch(false);
      router.push(route);
    });

    socket.on("connect_error", (connectError) => {
      console.error(connectError);
      setSocketConnected(false);
      setError(
        connectError.message
          ? `Unable to connect to live lobby updates: ${connectError.message}`
          : "Unable to connect to live lobby updates.",
      );
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [lobbyId, router, user]);

  useEffect(() => {
    if (!lobby) {
      return;
    }

    setStatus(getStatusMessage(lobby, user?.id ?? null));
  }, [lobby, user]);

  async function emitSocketEvent(event: string, payload: Record<string, unknown>) {
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

  async function handleAttack(targetUserId: string) {
    if (!lobby || !user) {
      return;
    }

    setAttackingTargetId(targetUserId);
    setError("");

    try {
      const result = await emitSocketEvent("game:attack", {
        lobbyId: lobby.id,
        targetUserId,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }
    } catch (attackError) {
      console.error(attackError);
      setError(attackError instanceof Error ? attackError.message : "Could not attack player.");
      setAttackingTargetId(null);
    }
  }

  async function handlePlayAgain() {
    if (!lobby) {
      return;
    }

    setRestartingMatch(true);
    setError("");

    try {
      const result = await emitSocketEvent("game:restart", {
        lobbyId: lobby.id,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      router.push(`/play?lobby=${lobby.id}`);
    } catch (restartError) {
      console.error(restartError);
      setError(
        restartError instanceof Error
          ? restartError.message
          : "Could not reset the match back to the lobby.",
      );
      setRestartingMatch(false);
    }
  }

  const currentPlayer = user
    ? lobby?.players.find((player) => player.userId === user.id) ?? null
    : null;
  const currentMatchPlayer =
    user && lobby?.match ? getMatchPlayer(lobby.match, user.id) : null;
  const alivePlayers =
    lobby?.match?.players.filter((player) => player.health > 0).length ?? 0;
  const canAttack = Boolean(
    socketConnected &&
      lobby?.match?.status === "active" &&
      currentMatchPlayer &&
      currentMatchPlayer.health > 0,
  );
  const resultMessage =
    lobby?.match?.status === "finished" ? getResultMessage(lobby, user?.id ?? null) : "";
  const lastActionMessage = getLastActionMessage(lobby);

  if (!user) {
    return (
      <section className={styles.panel}>
        <p className={styles.label}>Session required</p>
        <h2>Sign in before joining a match.</h2>
        <p className={styles.muted}>
          The game room uses the same Firebase and Express session as the lobby flow.
        </p>
        <Link className={styles.linkButton} href="/login">
          Go to login
        </Link>
      </section>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.kicker}>Game Room</p>
          <h1>Match {lobby?.inviteCode || "loading"}</h1>
          <p className={styles.copy}>
            Health bars and attacks are synced through the same lobby record, so every hit updates
            for both players in real time.
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
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.label}>Battle status</p>
              <h2>{status}</h2>
            </div>
            <span className={styles.state}>{socketConnected ? "Socket online" : "Socket offline"}</span>
          </div>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Lobby state</span>
              <strong>{lobby?.state || "loading"}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Damage per hit</span>
              <strong>{lobby?.match?.damagePerAttack ?? "--"}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Players standing</span>
              <strong>{lobby?.match ? alivePlayers : "--"}</strong>
            </div>
          </div>

          {lastActionMessage ? <p className={styles.muted}>{lastActionMessage}</p> : null}
          {resultMessage ? <p className={styles.result}>{resultMessage}</p> : null}
          {lobby?.match?.status === "finished" ? (
            <div className={styles.resultActions}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => void handlePlayAgain()}
                disabled={restartingMatch}
              >
                {restartingMatch ? "Resetting lobby..." : "Play Again"}
              </button>
            </div>
          ) : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {currentPlayer ? (
            <p className={styles.muted}>
              Signed in as {formatPlayerName(currentPlayer)}.
            </p>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.label}>Players</p>
              <h2>{lobby?.players.length || 0} in the arena</h2>
            </div>
            {lobby?.match ? (
              <span className={styles.state}>
                {lobby.match.status === "active" ? "Match active" : "Match finished"}
              </span>
            ) : null}
          </div>

          {lobby ? (
            <ol className={styles.fighterGrid}>
              {lobby.players.map((player) => {
                const matchPlayer = getMatchPlayer(lobby.match, player.userId);
                const healthPercent = getHealthPercent(lobby.match, matchPlayer);
                const isCurrentPlayer = player.userId === user.id;
                const isEliminated = Boolean(matchPlayer && matchPlayer.health <= 0);
                const canTarget = canAttack && !isCurrentPlayer && !isEliminated;

                return (
                  <li key={player.userId} className={styles.fighterCard}>
                    <div className={styles.fighterHeader}>
                      <div className={styles.fighterIdentity}>
                        <strong>{formatPlayerName(player)}</strong>
                        <small>{formatPlayerRank(player)}</small>
                      </div>
                      <span className={styles.badge}>
                        {getPlayerOutcomeLabel(lobby, player, matchPlayer, user.id)}
                      </span>
                    </div>

                    <div className={styles.healthRow}>
                      <div
                        className={styles.healthTrack}
                        aria-label={`${formatPlayerName(player)} health ${Math.round(healthPercent)} percent`}
                        role="img"
                      >
                        <div
                          className={styles.healthFill}
                          style={{ width: `${healthPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className={styles.actionRow}>
                      <span className={styles.meta}>
                        {player.isHost ? "Host" : "Player"} ·{" "}
                        {isCurrentPlayer ? "You" : "Opponent"}
                      </span>

                      {!isCurrentPlayer ? (
                        <button
                          type="button"
                          className={styles.attackButton}
                          onClick={() => void handleAttack(player.userId)}
                          disabled={!canTarget || attackingTargetId === player.userId}
                        >
                          {attackingTargetId === player.userId ? "Casting..." : `Attack ${formatPlayerName(player)}`}
                        </button>
                      ) : (
                        <span className={styles.selfTag}>Your character</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={styles.muted}>Loading players...</p>
          )}
        </div>
      </section>
    </main>
  );
}
