import type { Request, Response } from "express";
import { adminAuth } from "./firebaseAdmin";
import { config, isProduction } from "./config";
import { getUserByFirebaseUid, upsertUser } from "./db";

const sessionExpiresMs =
  config.sessionExpiresDays * 24 * 60 * 60 * 1000;

const usingEmulator = Boolean(config.firebaseAuthEmulatorHost);

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

function sanitizeDisplayName(name: string | undefined | null): string | null {
  if (!name) return null;
  const trimmed = name.trim().replace(/[\x00-\x1F\x7F]/g, "");
  if (!trimmed) return null;
  return trimmed.length > 30 ? trimmed.slice(0, 30) : trimmed;
}

export async function createSession(idToken: string, requestedDisplayName?: string) {
  const decoded = await adminAuth.verifyIdToken(idToken);

  let sessionCookie: string;

  if (usingEmulator) {
    sessionCookie = idToken;
  } else {
    sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: sessionExpiresMs,
    });
  }

  const user = await upsertUser({
    firebaseUid: decoded.uid,
    email: decoded.email ?? null,
    displayName: sanitizeDisplayName(requestedDisplayName) || sanitizeDisplayName(decoded.name) || null,
  });

  return { sessionCookie, user };
}

export async function getSessionUserFromSessionCookie(sessionCookie?: string) {
  if (!sessionCookie) {
    return null;
  }

  try {
    if (usingEmulator) {
      // In emulator mode the cookie is the raw ID token. Try verifying as
      // an ID token first; if that fails (e.g. stale session cookie from a
      // previous run that used createSessionCookie), try as a session cookie.
      try {
        const decoded = await adminAuth.verifyIdToken(sessionCookie, false);
        return getUserByFirebaseUid(decoded.uid);
      } catch {
        const decoded = await adminAuth.verifySessionCookie(sessionCookie, false);
        return getUserByFirebaseUid(decoded.uid);
      }
    }

    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    return getUserByFirebaseUid(decoded.uid);
  } catch {
    // Stale or invalid cookie — silently return null so the user is
    // prompted to sign in again instead of seeing a 500.
    return null;
  }
}

export async function getSessionUser(request: Request) {
  return getSessionUserFromSessionCookie(
    request.cookies?.[config.sessionCookieName],
  );
}
