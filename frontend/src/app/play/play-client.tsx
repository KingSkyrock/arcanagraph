"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiBaseUrl, apiUrl } from "@/lib/api";
import type { AppUser, Lobby, LobbyPlayer } from "@/lib/types";

type LobbyResponse = {
  lobby: Lobby;
  error?: string;
};

type SessionResponse = {
  user: AppUser | null;
  error?: string;
};

type SocketResult = { ok: true; data: { lobbyId: string } } | { ok: false; error: string };

function formatPlayerName(player: Pick<LobbyPlayer, "displayName">) {
  return player.displayName || "Unknown player";
}

function formatPlayerRank(player: Pick<LobbyPlayer, "level" | "className" | "xp">) {
  return `Level ${player.level} ${player.className} · ${player.xp} XP`;
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  shapes: "Shapes",
  beginner: "Beginner Functions",
  advanced: "Advanced Functions",
  custom: "Custom",
};

type PlayClientProps = {
  autoCreateWithDifficulty?: string | null;
  joinInviteCode?: string;
  onClose?: () => void;
};

export function PlayClient({ autoCreateWithDifficulty, joinInviteCode, onClose }: PlayClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeLobbyId = searchParams.get("lobby");
  const socketRef = useRef<Socket | null>(null);
  const autoActionDone = useRef(false);
  const activeLobbyIdRef = useRef(activeLobbyId);
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
    activeLobbyIdRef.current = activeLobbyId;
  }, [activeLobbyId]);

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
        currentStatus.includes("Signed in") ? currentStatus : "Connected.",
      );
    });

    socket.on("disconnect", () => {
      setSocketConnected(false);
      setStatus("Connection lost. Reconnecting...");
    });

    socket.on("connect_error", (connectError) => {
      console.error(connectError);
      setSocketConnected(false);
      setError(
        "Unable to connect to the game server. Please try again.",
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
      if (lobbyId === activeLobbyIdRef.current) {
        setStatus("Everyone is ready. Spinning up the match...");
      }
    });

    socket.on("game:started", ({ lobbyId, route }: { lobbyId: string; route: string }) => {
      if (lobbyId === activeLobbyIdRef.current) {
        router.push(route);
      }
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, [router, user]);

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

  // Auto-create lobby or auto-join via invite code when props are provided
  useEffect(() => {
    if (!socketConnected || !user || autoActionDone.current || activeLobbyId) {
      return;
    }

    if (autoCreateWithDifficulty) {
      autoActionDone.current = true;
      void handleCreateLobby(autoCreateWithDifficulty);
    } else if (joinInviteCode) {
      autoActionDone.current = true;
      setInviteCode(joinInviteCode);
      void (async () => {
        setBusy(true);
        setError("");
        try {
          const result = await emitLobbyEvent("lobby:join", {
            inviteCode: joinInviteCode.trim().toUpperCase(),
          });
          if (!result.ok) throw new Error(result.error);
          await loadLobby(result.data.lobbyId);
          router.replace(`/play?lobby=${result.data.lobbyId}`);
        } catch (e) {
          console.error(e);
          setError(e instanceof Error ? e.message : "Could not join lobby.");
        } finally {
          setBusy(false);
        }
      })();
    }
  }, [socketConnected, user, autoCreateWithDifficulty, joinInviteCode, activeLobbyId]);

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
      setStatus("Game server is unavailable right now. Please try again later.");
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
      return { ok: false, error: "Still connecting to the game server. Try again in a moment." } satisfies SocketResult;
    }

    return await new Promise<SocketResult>((resolve) => {
      socket.emit(event, payload, (result: SocketResult) => {
        resolve(result);
      });
    });
  }

  async function handleCreateLobby(difficulty?: string | null) {
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
            difficulty: difficulty || "advanced",
            maxHealth: 40, // Debug: 2 hits to win. Remove for production.
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
      setError("Still connecting to the game server. Try again in a moment.");
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

  const panelStyle: React.CSSProperties = {
    display: 'grid', gap: 18, padding: 24,
    border: '1px solid rgba(255,255,255,0.18)', borderRadius: 30,
    background: 'rgba(11,31,92,0.24)',
    boxShadow: '0 28px 60px rgba(10,20,68,0.22), inset 0 1px 0 rgba(255,255,255,0.16)',
    backdropFilter: 'blur(14px)', alignContent: 'start',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 800, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.74)',
  };
  const headingStyle: React.CSSProperties = {
    fontSize: 'clamp(28px,4vw,44px)', lineHeight: 0.95,
    letterSpacing: '-0.05em', color: '#fff',
    fontWeight: 900,
  };
  const legoBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minHeight: 48, padding: '0 18px', border: 0, borderRadius: 18,
    fontWeight: 800, cursor: 'pointer', color: '#fff',
    background: '#f59e0b',
    boxShadow: '0 4px 0 #b45309, 0 4px 12px rgba(0,0,0,0.2)',
    transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.18s',
    fontFamily: "'Nunito',system-ui,sans-serif", fontSize: 16,
  };
  const ghostBtn: React.CSSProperties = {
    ...legoBtn,
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: 'none',
  };
  const pillStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 999,
    background: 'rgba(245,158,11,0.18)', fontSize: 13, fontWeight: 800, color: '#fff3c4',
  };

  if (!user) {
    return (
      <section style={panelStyle}>
        <p style={labelStyle}>Session required</p>
        <h2 style={headingStyle}>Sign in before joining a match.</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.84)' }}>
          Log in with your Arcanagraph player account to create or join a multiplayer lobby.
        </p>
        <Link href="/login" style={legoBtn}>Go to login</Link>
      </section>
    );
  }

  const lobbyDifficulty = lobby?.settings?.difficulty as string | undefined;
  const difficultyLabel = lobbyDifficulty ? (DIFFICULTY_LABELS[lobbyDifficulty] || lobbyDifficulty) : "Default";

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <p style={labelStyle}>Active lobby</p>
          <h2 style={headingStyle}>{lobby ? lobby.inviteCode : "Setting up..."}</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lobby ? <span style={pillStyle}>{difficultyLabel}</span> : null}
          <span style={pillStyle}>{socketConnected ? "Connected" : "Connecting..."}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.14)' }}>
        <p style={labelStyle}>Status</p>
        <strong style={{ fontSize: 20, lineHeight: 1.35 }}>{status}</strong>
        {error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ color: '#fca5a5', fontSize: 14, flex: 1 }}>{error}</p>
            <button type="button" style={{
              ...ghostBtn, minHeight: 36, padding: '0 14px', fontSize: 13,
            }} onClick={() => { setError(''); void loadSession(); }}>
              Retry
            </button>
          </div>
        ) : null}
      </div>

      {lobby ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
            {[
              { label: 'Invite code', value: lobby.inviteCode },
              { label: 'Players', value: String(lobby.players.length) },
              { label: 'Host', value: isHost ? 'You' : 'Another player' },
            ].map(d => (
              <div key={d.label} style={{ display: 'grid', gap: 6, padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>{d.label}</span>
                <strong style={{ fontSize: 24, lineHeight: 1, color: '#fff' }}>{d.value}</strong>
              </div>
            ))}
          </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button type="button" style={ghostBtn} onClick={handleReadyToggle} disabled={busy || !currentPlayer || lobby.state !== "waiting"}>
                {currentPlayer?.ready ? "Unready" : "Ready up"}
              </button>
              {isHost ? (
                <button type="button" style={{
                  ...legoBtn,
                  ...( (busy || !allPlayersReady || lobby.state !== "waiting") ? { opacity: 0.45, cursor: 'not-allowed', filter: 'grayscale(0.4)' } : {}),
                }} onClick={handleStartGame} disabled={busy || !allPlayersReady || lobby.state !== "waiting"}>
                  Start game
                </button>
              ) : null}
              {lobby.state === "in_game" ? (
                <Link href={`/game/${lobby.id}`} style={ghostBtn}>Open game</Link>
              ) : null}
              <button
                type="button"
                style={{ ...ghostBtn, color: '#fca5a5', borderColor: 'rgba(252,165,165,0.3)' }}
                onClick={() => {
                  setLobby(null);
                  setError('');
                  setStatus('');
                  autoActionDone.current = false;
                  // Clear URL immediately so activeLobbyId doesn't block the next auto-action
                  window.history.replaceState(null, '', '/play');
                  if (onClose) onClose();
                  else router.replace('/play');
                }}
              >
                Close Lobby
              </button>
            </div>

            <ol style={{ display: 'grid', gap: 12, padding: 0, listStyle: 'none' }}>
              {lobby.players.map((player) => (
                <li key={player.userId} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 14,
                  alignItems: 'center', padding: '16px 18px', borderRadius: 20,
                  background: 'rgba(255,255,255,0.12)',
                }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 17 }}>{formatPlayerName(player)}</strong>
                    <small style={{ fontSize: 12, lineHeight: 1.4, color: 'rgba(255,255,255,0.74)' }}>{formatPlayerRank(player)}</small>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.74)' }}>
                    {player.isHost ? "Host" : "Player"} · {player.ready ? "Ready" : "Waiting"}
                  </span>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(255,255,255,0.84)' }}>
              Creating your lobby...
            </p>
            <button
              type="button"
              style={{ ...ghostBtn, color: '#fca5a5', borderColor: 'rgba(252,165,165,0.3)', alignSelf: 'flex-start' }}
              onClick={() => {
                  setLobby(null);
                  setError('');
                  setStatus('');
                  autoActionDone.current = false;
                  // Clear URL immediately so activeLobbyId doesn't block the next auto-action
                  window.history.replaceState(null, '', '/play');
                  if (onClose) onClose();
                  else router.replace('/play');
                }}
            >
              Cancel
            </button>
          </div>
        )}
    </div>
  );
}
