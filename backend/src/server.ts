import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { config } from "./config";
import {
  clearSessionCookie,
  createSession,
  getSessionUser,
  setSessionCookie,
} from "./auth";
import { getLeaderboard, pingDatabase } from "./db";

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

async function start() {
  await pingDatabase();
  const app = createApp();
  const server = createServer(app);

  server.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
