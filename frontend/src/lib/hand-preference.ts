"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "./api";
import { emitSessionUserUpdated } from "./session-user-events";
import type { AppUser, PrimaryHand } from "./types";

const PRIMARY_HAND_STORAGE_KEY = "arcanagraph.primary-hand";

type UpdatePrimaryHandResponse = {
  user: AppUser | null;
  error?: string;
};

export type HandPreferenceSource = "profile" | "local" | "unset";

function isPrimaryHand(value: unknown): value is PrimaryHand {
  return value === "Left" || value === "Right";
}

export function formatPrimaryHandLabel(primaryHand: PrimaryHand) {
  return primaryHand === "Left" ? "Left hand" : "Right hand";
}

export function readStoredPrimaryHand() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(PRIMARY_HAND_STORAGE_KEY);
    return isPrimaryHand(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPrimaryHand(primaryHand: PrimaryHand) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PRIMARY_HAND_STORAGE_KEY, primaryHand);
  } catch {
    // Ignore storage write failures so gameplay can continue.
  }
}

async function persistPrimaryHandToProfile(primaryHand: PrimaryHand) {
  const response = await fetch(apiUrl("/api/settings/hand"), {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ primaryHand }),
  });
  const payload = (await response.json()) as UpdatePrimaryHandResponse;

  if (!response.ok || !payload.user) {
    throw new Error(
      payload.error || "Could not save your primary hand to your player profile.",
    );
  }

  return payload.user;
}

export function usePrimaryHandPreference(
  sessionUser: AppUser | null,
  sessionReady: boolean,
) {
  const sessionUserId = sessionUser?.id ?? null;
  const profileHand = sessionUser?.primaryHand ?? null;
  const [primaryHand, setPrimaryHand] = useState<PrimaryHand | null>(null);
  const [source, setSource] = useState<HandPreferenceSource>("unset");
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lastAutoSyncKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionReady) {
      setReady(false);
      return;
    }

    const storedHand = readStoredPrimaryHand();

    if (profileHand) {
      writeStoredPrimaryHand(profileHand);
      setPrimaryHand(profileHand);
      setSource("profile");
      setError("");
      setReady(true);
      return;
    }

    if (storedHand) {
      setPrimaryHand(storedHand);
      setSource("local");
      setError("");
      setReady(true);

      if (sessionUserId) {
        const syncKey = `${sessionUserId}:${storedHand}`;

        if (lastAutoSyncKeyRef.current !== syncKey) {
          lastAutoSyncKeyRef.current = syncKey;
          void persistPrimaryHandToProfile(storedHand)
            .then((updatedUser) => {
              const syncedHand = updatedUser.primaryHand ?? storedHand;
              emitSessionUserUpdated(updatedUser);
              writeStoredPrimaryHand(syncedHand);
              setPrimaryHand(syncedHand);
              setSource("profile");
              setError("");
            })
            .catch((syncError) => {
              console.warn("Could not sync the stored primary hand to the player profile.", syncError);
              setError(
                "Your hand choice was kept in this browser, but it could not be synced to your player profile yet.",
              );
            });
        }
      }

      return;
    }

    setPrimaryHand(null);
    setSource("unset");
    setError("");
    setReady(true);
  }, [profileHand, sessionReady, sessionUserId]);

  async function savePrimaryHand(nextPrimaryHand: PrimaryHand) {
    writeStoredPrimaryHand(nextPrimaryHand);
    setPrimaryHand(nextPrimaryHand);
    setReady(true);
    setError("");

    if (!sessionUserId) {
      setSource("local");
      return;
    }

    setSaving(true);

    try {
      const updatedUser = await persistPrimaryHandToProfile(nextPrimaryHand);
      const savedHand = updatedUser.primaryHand ?? nextPrimaryHand;

      emitSessionUserUpdated(updatedUser);
      writeStoredPrimaryHand(savedHand);
      setPrimaryHand(savedHand);
      setSource("profile");
      lastAutoSyncKeyRef.current = `${sessionUserId}:${savedHand}`;
    } catch (saveError) {
      console.error(saveError);
      setSource("local");
      setError(
        saveError instanceof Error
          ? `${saveError.message} Your choice is still saved in this browser.`
          : "Your choice is saved in this browser, but it could not be synced to your player profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    primaryHand,
    source,
    ready,
    saving,
    error,
    savePrimaryHand,
  };
}
