import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import { getFirebaseAdminSummary, pingFirebaseAdmin } from "./firebaseAdmin";
import {
  requireAttackScore,
  requireLobbyId,
  requireReadyValue,
  requireTargetUserId,
} from "./socket-payload";
import {
  clearSessionCookie,
  createSession,
  getSessionUser,
  getSessionUserFromSessionCookie,
  setSessionCookie,
} from "./auth";
import {
  attackLobbyPlayer,
  type AppUser,
  createLobby,
  ensureDatabaseSchema,
  getLeaderboard,
  getLobbyByIdForUser,
  joinLobbyById,
  joinLobbyByInviteCode,
  pingDatabase,
  restartLobbyMatch,
  startLobbyGame,
  updateLobbyPlayerReady,
} from "./db";

type SocketResult<T> = { ok: true; data: T } | { ok: false; error: string };
type SocketPayload = {
  inviteCode?: string;
  lobbyId?: string;
  ready?: boolean;
  targetUserId?: string;
  score?: number;
};

function getStatusCode(error: unknown) {
  const maybeStatus = (error as { statusCode?: number }).statusCode;
  return typeof maybeStatus === "number" ? maybeStatus : 500;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isFirebaseAuthError(error: unknown) {
  const maybeCode =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;

  return typeof maybeCode === "string" && maybeCode.startsWith("auth/");
}

function getSessionCreationFailure(error: unknown) {
  if (isFirebaseAuthError(error)) {
    return {
      statusCode: 401,
      message: getErrorMessage(
        error,
        "Unable to create session. Your Firebase login may have expired.",
      ),
    };
  }

  const statusCode = getStatusCode(error);
  return {
    statusCode,
    message:
      statusCode === 500
        ? "Unable to finish sign-in because your player profile could not be saved right now."
        : getErrorMessage(error, "Unable to finish sign-in right now."),
  };
}

function parseCookies(cookieHeader?: string) {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const name = decodeURIComponent(part.slice(0, separatorIndex).trim());
    const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
    cookies[name] = value;
  }

  return cookies;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function requireSessionUser(
  request: express.Request,
  response: express.Response,
) {
  const user = await getSessionUser(request);

  if (!user) {
    response.status(401).json({ error: "Sign in first to access lobby features." });
    return null;
  }

  return user;
}

function createApp() {
  const app = express();
  const dataDir = path.resolve(__dirname, "../../data");
  const computerVisionDir = path.resolve(__dirname, "../../computervision");

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.frontendOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use("/data", express.static(dataDir));
  app.use("/computervision", express.static(computerVisionDir));

  app.get("/api/health", async (_request, response) => {
    await pingDatabase();
    response.json({ ok: true });
  });

  app.get("/api/auth/target", async (_request, response) => {
    const firebase = getFirebaseAdminSummary();

    try {
      await pingFirebaseAdmin();
      response.json({
        ok: true,
        firebase: {
          mode: firebase.mode,
          projectId: firebase.projectId,
          reachable: true,
        },
      });
    } catch (error) {
      console.error("Failed to verify backend Firebase target", error);
      response.status(503).json({
        ok: false,
        error: "Backend cannot reach the configured Firebase auth target right now.",
        firebase: {
          mode: firebase.mode,
          projectId: firebase.projectId,
          reachable: false,
        },
      });
    }
  });

  app.post("/api/auth/session", async (request, response) => {
    try {
      const idToken = String(request.body?.idToken || "");
      const displayName =
        typeof request.body?.displayName === "string"
          ? request.body.displayName
          : undefined;

      if (!idToken) {
        response.status(400).json({ error: "Missing Firebase ID token" });
        return;
      }

      const { sessionCookie, user } = await createSession(idToken, displayName);
      setSessionCookie(response, sessionCookie);
      response.json({ user });
    } catch (error) {
      console.error("Failed to create session", error);
      const failure = getSessionCreationFailure(error);
      response.status(failure.statusCode).json({ error: failure.message });
    }
  });

  app.post("/api/auth/logout", async (_request, response) => {
    clearSessionCookie(response);
    response.status(204).send();
  });

  app.get("/api/auth/me", async (request, response) => {
    const user = await getSessionUser(request);

    if (!user) {
      response.status(401).json({ user: null });
      return;
    }

    response.json({ user });
  });

  app.get("/api/leaderboard", async (request, response) => {
    try {
      const requestedLimit = Number(request.query.limit ?? 10);
      const limit = Math.min(Math.max(requestedLimit || 10, 1), 25);
      const leaderboard = await getLeaderboard(limit);
      response.json({ leaderboard });
    } catch (error) {
      console.error("Failed to load leaderboard", error);
      response.status(500).json({ error: "Unable to load leaderboard" });
    }
  });

  app.post("/api/lobbies", async (request, response) => {
    const user = await requireSessionUser(request, response);

    if (!user) {
      return;
    }

    try {
      const settings = isRecord(request.body?.settings) ? request.body.settings : {};
      const lobby = await createLobby(user.id, settings);
      response.status(201).json({ lobby });
    } catch (error) {
      console.error("Failed to create lobby", error);
      response.status(getStatusCode(error)).json({
        error: getErrorMessage(error, "Unable to create lobby."),
      });
    }
  });

  app.get("/api/lobbies/:lobbyId", async (request, response) => {
    const user = await requireSessionUser(request, response);

    if (!user) {
      return;
    }

    try {
      const lobby = await getLobbyByIdForUser(request.params.lobbyId, user.id);
      response.json({ lobby });
    } catch (error) {
      console.error("Failed to load lobby", error);
      response.status(getStatusCode(error)).json({
        error: getErrorMessage(error, "Unable to load lobby."),
      });
    }
  });

  app.use(
    (
      error: Error,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error("Unhandled server error", error);
      response.status(500).json({ error: "Internal server error" });
    },
  );

  return app;
}

function registerLobbySockets(io: SocketIOServer) {
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const sessionCookie = cookies[config.sessionCookieName];
      const user = await getSessionUserFromSessionCookie(sessionCookie);

      if (!user) {
        next(new Error("Sign in first to join or manage a lobby."));
        return;
      }

      socket.data.user = user;
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AppUser | undefined;

    if (!user) {
      socket.disconnect(true);
      return;
    }

    const emitFailure = <T>(ack: ((result: SocketResult<T>) => void) | undefined, error: unknown) => {
      const message = getErrorMessage(error, "Something went wrong.");
      socket.emit("lobby:error", { message });
      ack?.({ ok: false, error: message });
    };

    socket.on(
      "lobby:join",
      async (
        payload: SocketPayload,
        ack?: (result: SocketResult<{ lobbyId: string }>) => void,
      ) => {
        try {
          const inviteCode =
            typeof payload.inviteCode === "string" ? payload.inviteCode.trim() : "";
          const lobbyId = typeof payload.lobbyId === "string" ? payload.lobbyId.trim() : "";
          const lobby =
            inviteCode
              ? await joinLobbyByInviteCode(inviteCode, user.id)
              : lobbyId
                ? await joinLobbyById(lobbyId, user.id)
                : null;

          if (!lobby) {
            throw new Error("Lobby id or invite code is required.");
          }

          socket.join(`lobby:${lobby.id}`);
          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
          ack?.({ ok: true, data: { lobbyId: lobby.id } });
        } catch (error) {
          emitFailure(ack, error);
        }
      },
    );

    socket.on(
      "lobby:ready",
      async (
        payload: SocketPayload,
        ack?: (result: SocketResult<{ lobbyId: string }>) => void,
      ) => {
        try {
          const lobby = await updateLobbyPlayerReady(
            requireLobbyId(payload.lobbyId),
            user.id,
            requireReadyValue(payload.ready),
          );

          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
          ack?.({ ok: true, data: { lobbyId: lobby.id } });
        } catch (error) {
          emitFailure(ack, error);
        }
      },
    );

    socket.on(
      "game:attack",
      async (
        payload: SocketPayload,
        ack?: (result: SocketResult<{ lobbyId: string }>) => void,
      ) => {
        try {
          const lobby = await attackLobbyPlayer(
            requireLobbyId(payload.lobbyId),
            user.id,
            requireTargetUserId(payload.targetUserId),
            requireAttackScore(payload.score),
          );

          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });

          if (lobby.match?.status === "finished") {
            io.to(`lobby:${lobby.id}`).emit("game:over", {
              lobbyId: lobby.id,
              winnerUserId: lobby.match.winnerUserId,
            });
          }

          ack?.({ ok: true, data: { lobbyId: lobby.id } });
        } catch (error) {
          emitFailure(ack, error);
        }
      },
    );

    socket.on(
      "game:restart",
      async (
        payload: SocketPayload,
        ack?: (result: SocketResult<{ lobbyId: string }>) => void,
      ) => {
        try {
          const lobby = await restartLobbyMatch(requireLobbyId(payload.lobbyId), user.id);
          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
          io.to(`lobby:${lobby.id}`).emit("game:restarted", {
            lobbyId: lobby.id,
            route: `/play?lobby=${lobby.id}`,
          });
          ack?.({ ok: true, data: { lobbyId: lobby.id } });
        } catch (error) {
          emitFailure(ack, error);
        }
      },
    );

    socket.on(
      "lobby:start",
      async (
        payload: SocketPayload,
        ack?: (result: SocketResult<{ lobbyId: string }>) => void,
      ) => {
        try {
          const lobby = await startLobbyGame(requireLobbyId(payload.lobbyId), user.id);
          io.to(`lobby:${lobby.id}`).emit("game:starting", { lobbyId: lobby.id });
          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
          io.to(`lobby:${lobby.id}`).emit("game:started", {
            lobbyId: lobby.id,
            route: `/game/${lobby.id}`,
          });
          ack?.({ ok: true, data: { lobbyId: lobby.id } });
        } catch (error) {
          emitFailure(ack, error);
        }
      },
    );
  });
}

async function start() {
  await ensureDatabaseSchema();
  await pingDatabase();

  const app = createApp();
  const server = createServer(app);
  const io = new SocketIOServer(server, {
    cors: {
      origin: config.frontendOrigins,
      credentials: true,
    },
  });

  registerLobbySockets(io);

  server.listen(config.port, () => {
    const firebase = getFirebaseAdminSummary();
    console.log(`Backend listening on http://localhost:${config.port}`);
    console.log(
      `Firebase admin target: ${firebase.mode === "emulator" ? `emulator (${firebase.emulatorHost})` : `project ${firebase.projectId}`} via ${firebase.credentialSource}`,
    );
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
