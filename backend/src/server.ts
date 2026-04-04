import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { config } from "./config";
import {
  clearSessionCookie,
  createSession,
  getSessionUser,
  getSessionUserFromSessionCookie,
  setSessionCookie,
} from "./auth";
import {
  type AppUser,
  createLobby,
  ensureDatabaseSchema,
  getLeaderboard,
  getLobbyByIdForUser,
  joinLobbyById,
  joinLobbyByInviteCode,
  markLobbyInGame,
  pingDatabase,
  startLobbyGame,
  updateLobbyPlayerReady,
} from "./db";

type SocketResult<T> = { ok: true; data: T } | { ok: false; error: string };
type SocketPayload = {
  inviteCode?: string;
  lobbyId?: string;
  ready?: boolean;
};

function getStatusCode(error: unknown) {
  const maybeStatus = (error as { statusCode?: number }).statusCode;
  return typeof maybeStatus === "number" ? maybeStatus : 500;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
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
    response.status(401).json({ error: "Sign in first." });
    return null;
  }

  return user;
}

function createApp() {
  const app = express();

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

  app.get("/api/health", async (_request, response) => {
    await pingDatabase();
    response.json({ ok: true });
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
      response.status(401).json({ error: "Unable to create session" });
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
        next(new Error("Unauthorized"));
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
          const lobby =
            typeof payload.inviteCode === "string" && payload.inviteCode.trim()
              ? await joinLobbyByInviteCode(payload.inviteCode, user.id)
              : typeof payload.lobbyId === "string" && payload.lobbyId.trim()
                ? await joinLobbyById(payload.lobbyId, user.id)
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
          if (typeof payload.lobbyId !== "string") {
            throw new Error("Lobby id is required.");
          }

          const lobby = await updateLobbyPlayerReady(
            payload.lobbyId,
            user.id,
            Boolean(payload.ready),
          );

          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
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
          if (typeof payload.lobbyId !== "string") {
            throw new Error("Lobby id is required.");
          }

          const lobby = await startLobbyGame(payload.lobbyId, user.id);
          io.to(`lobby:${lobby.id}`).emit("lobby:update", { lobby });
          io.to(`lobby:${lobby.id}`).emit("game:starting", { lobbyId: lobby.id });
          ack?.({ ok: true, data: { lobbyId: lobby.id } });

          setTimeout(async () => {
            try {
              const activeLobby = await markLobbyInGame(lobby.id);
              io.to(`lobby:${activeLobby.id}`).emit("lobby:update", {
                lobby: activeLobby,
              });
              io.to(`lobby:${activeLobby.id}`).emit("game:started", {
                lobbyId: activeLobby.id,
                route: `/game/${activeLobby.id}`,
              });
            } catch (error) {
              console.error("Failed to mark lobby in game", error);
            }
          }, 1500);
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
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
