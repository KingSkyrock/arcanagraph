import type { Request, Response } from "express";
import { adminAuth } from "./firebaseAdmin";
import { config, isProduction } from "./config";
import { getUserByFirebaseUid, upsertUser } from "./db";

const sessionExpiresMs =
  config.sessionExpiresDays * 24 * 60 * 60 * 1000;

export function setSessionCookie(response: Response, sessionCookie: string) {
  response.cookie(config.sessionCookieName, sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: sessionExpiresMs,
    path: "/",
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(config.sessionCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
  });
}

export async function createSession(idToken: string, requestedDisplayName?: string) {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: sessionExpiresMs,
  });

  const user = await upsertUser({
    firebaseUid: decoded.uid,
    email: decoded.email ?? null,
    displayName: requestedDisplayName?.trim() || decoded.name?.trim() || null,
  });

  return { sessionCookie, user };
}

export async function getSessionUser(request: Request) {
  const sessionCookie = request.cookies?.[config.sessionCookieName];

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return getUserByFirebaseUid(decoded.uid);
  } catch (error) {
    console.error("Failed to verify session cookie", error);
    return null;
  }
}
