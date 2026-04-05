"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { apiUrl } from "@/lib/api";
import {
  formatPrimaryHandLabel,
  usePrimaryHandPreference,
} from "@/lib/hand-preference";
import {
  formatProfilePictureUnlock,
  getDefaultProfilePicture,
  getProfilePictureById,
  isProfilePictureUnlocked,
  loadProfilePictureCatalog,
  type ProfilePictureCatalogEntry,
} from "@/lib/profile-pictures";
import { emitSessionUserUpdated } from "@/lib/session-user-events";
import type { AppUser, PrimaryHand } from "@/lib/types";
import sharedStyles from "../game/[lobbyId]/page.module.css";
import settingsStyles from "./page.module.css";

type SessionResponse = {
  user: AppUser | null;
  error?: string;
};

function formatPlayerLabel(user: AppUser | null) {
  if (!user) {
    return "player";
  }

  return user.displayName || user.email || "player";
}

function getStorageMessage(
  sessionUser: AppUser | null,
  source: "profile" | "local" | "unset",
) {
  if (source === "profile") {
    return "Saved to your player profile and mirrored in this browser.";
  }

  if (source === "local") {
    return sessionUser
      ? "Using the choice saved in this browser until your player profile sync finishes."
      : "Saved locally in this browser because you are not signed in.";
  }

  return "Choose a primary hand before starting hand tracking.";
}

export default function SettingsPage() {
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("Loading your settings...");
  const [profilePictures, setProfilePictures] = useState<
    ProfilePictureCatalogEntry[]
  >([]);
  const [profilePicturesReady, setProfilePicturesReady] = useState(false);
  const [profilePictureError, setProfilePictureError] = useState("");
  const [savingProfilePictureId, setSavingProfilePictureId] = useState("");
  const {
    primaryHand,
    source,
    ready,
    saving,
    error,
    savePrimaryHand,
  } = usePrimaryHandPreference(sessionUser, sessionReady);

  useEffect(() => {
    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then(async (response) => {
        if (response.status === 401) {
          setSessionUser(null);
          emitSessionUserUpdated(null);
          setSessionMessage(
            "Guest settings. Your hand choice will stay in this browser.",
          );
          return;
        }

        const payload = (await response.json()) as SessionResponse;

        if (!response.ok || !payload.user) {
          throw new Error(payload.error || "Could not load your player profile.");
        }

        setSessionUser(payload.user);
        emitSessionUserUpdated(payload.user);
        setSessionMessage(`Signed in as ${formatPlayerLabel(payload.user)}.`);
      })
      .catch((loadError) => {
        console.error(loadError);
        setSessionUser(null);
        emitSessionUserUpdated(null);
        setSessionMessage(
          "Could not reach your profile, so settings will stay local for now.",
        );
      })
      .finally(() => {
        setSessionReady(true);
      });
  }, []);

  useEffect(() => {
    loadProfilePictureCatalog()
      .then((catalog) => {
        setProfilePictures(catalog);
        setProfilePictureError("");
      })
      .catch((loadError) => {
        console.error(loadError);
        setProfilePictures([]);
        setProfilePictureError(
          "Profile pictures could not be loaded right now.",
        );
      })
      .finally(() => {
        setProfilePicturesReady(true);
      });
  }, []);

  const selectedProfilePicture = useMemo(() => {
    return (
      getProfilePictureById(profilePictures, sessionUser?.profilePictureId) ??
      getDefaultProfilePicture(profilePictures)
    );
  }, [profilePictures, sessionUser?.profilePictureId]);

  async function handleChooseHand(nextPrimaryHand: PrimaryHand) {
    await savePrimaryHand(nextPrimaryHand);
  }

  async function handleChooseProfilePicture(profilePictureId: string) {
    if (!sessionUser) {
      setProfilePictureError(
        "Sign in first to equip a profile picture on your player profile.",
      );
      return;
    }

    if (sessionUser.profilePictureId === profilePictureId) {
      return;
    }

    setSavingProfilePictureId(profilePictureId);
    setProfilePictureError("");

    try {
      const response = await fetch(apiUrl("/api/settings/profile-picture"), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profilePictureId }),
      });
      const payload = (await response.json()) as SessionResponse;

      if (!response.ok || !payload.user) {
        throw new Error(
          payload.error || "Could not update your profile picture.",
        );
      }

      setSessionUser(payload.user);
      emitSessionUserUpdated(payload.user);
      setSessionMessage(`Signed in as ${formatPlayerLabel(payload.user)}.`);
    } catch (saveError) {
      console.error(saveError);
      setProfilePictureError(
        saveError instanceof Error
          ? saveError.message
          : "Could not update your profile picture.",
      );
    } finally {
      setSavingProfilePictureId("");
    }
  }

  return (
    <main className={sharedStyles.page} style={{ paddingTop: 112 }}>
      <Navbar />
      <section className={sharedStyles.shell}>
        <div className={sharedStyles.hero}>
          <p className={sharedStyles.kicker}>Settings</p>
          <h1>Player Setup</h1>
          <p className={sharedStyles.copy}>
            Pick the hand used for tracking and choose the familiar portrait that
            represents your player profile across the app.
          </p>
          <p className={sharedStyles.muted}>{sessionMessage}</p>
          <div className={sharedStyles.links}>
            <Link className={sharedStyles.linkButton} href="/play">
              Back to play
            </Link>
            <Link className={sharedStyles.linkButton} href="/">
              Home
            </Link>
          </div>
        </div>

        <section className={sharedStyles.panel}>
          <div className={sharedStyles.panelHeader}>
            <div>
              <p className={sharedStyles.label}>Primary hand</p>
              <h2>
                {ready && primaryHand
                  ? formatPrimaryHandLabel(primaryHand)
                  : "Not chosen yet"}
              </h2>
            </div>
            <span className={sharedStyles.state}>
              {sessionUser ? "Profile-backed" : "Guest browser"}
            </span>
          </div>

          <p className={sharedStyles.muted}>
            {sessionReady
              ? getStorageMessage(sessionUser, source)
              : "Checking where this setting should be stored..."}
          </p>

          <div className={sharedStyles.links}>
            {(["Left", "Right"] as const).map((option) => {
              const isSelected = primaryHand === option;

              return (
                <button
                  key={option}
                  type="button"
                  className={
                    isSelected
                      ? sharedStyles.attackButton
                      : sharedStyles.linkButton
                  }
                  onClick={() => void handleChooseHand(option)}
                  disabled={!sessionReady || saving}
                >
                  {saving && isSelected
                    ? "Saving..."
                    : isSelected
                      ? `${formatPrimaryHandLabel(option)} selected`
                      : `Use ${formatPrimaryHandLabel(option)}`}
                </button>
              );
            })}
          </div>

          {error ? <p className={sharedStyles.error}>{error}</p> : null}
          <p className={sharedStyles.muted}>
            Reach goal: the current setting is single-hand only so the battle
            system has one clear tracked input today. We can extend this into a
            two-handed mode later without replacing this page.
          </p>
        </section>

        <section className={sharedStyles.panel}>
          <div className={sharedStyles.panelHeader}>
            <div>
              <p className={sharedStyles.label}>Profile picture</p>
              <h2>{selectedProfilePicture?.name ?? "Choose a familiar"}</h2>
            </div>
            <span className={sharedStyles.state}>
              {sessionUser
                ? `Level ${sessionUser.level} ${sessionUser.className}`
                : "Sign in required"}
            </span>
          </div>

          <p className={sharedStyles.muted}>
            Two familiars are available immediately. The last two unlock at low
            levels so players pick up progression quickly without waiting long.
          </p>

          <div className={settingsStyles.profileLayout}>
            <section className={settingsStyles.previewPanel}>
              <div className={settingsStyles.previewFrame}>
                {selectedProfilePicture ? (
                  <Image
                    src={selectedProfilePicture.imagePath}
                    alt={`${selectedProfilePicture.name} profile picture`}
                    fill
                    sizes="(max-width: 768px) 220px, 280px"
                    unoptimized
                    className={settingsStyles.previewImage}
                  />
                ) : (
                  <div className={settingsStyles.previewPlaceholder}>
                    Loading avatar
                  </div>
                )}
              </div>
              <div className={settingsStyles.previewMeta}>
                <strong>{selectedProfilePicture?.name ?? "No familiar loaded"}</strong>
                <span>
                  {sessionUser
                    ? `${formatPlayerLabel(sessionUser)} • Level ${sessionUser.level} ${sessionUser.className}`
                    : "Sign in to equip a familiar on your player profile."}
                </span>
                {selectedProfilePicture ? (
                  <span>{formatProfilePictureUnlock(selectedProfilePicture)}</span>
                ) : null}
              </div>
            </section>

            <div className={settingsStyles.profilePictureGrid}>
              {profilePictures.map((profilePicture) => {
                const isSelected =
                  sessionUser?.profilePictureId === profilePicture.id;
                const unlocked = isProfilePictureUnlocked(
                  sessionUser?.level,
                  profilePicture,
                );
                const disabled =
                  !sessionUser ||
                  !profilePicturesReady ||
                  savingProfilePictureId.length > 0 ||
                  !unlocked;
                const cardClassName = [
                  settingsStyles.profilePictureCard,
                  isSelected ? settingsStyles.profilePictureCardSelected : "",
                  !unlocked ? settingsStyles.profilePictureCardLocked : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={profilePicture.id}
                    type="button"
                    className={cardClassName}
                    onClick={() =>
                      void handleChooseProfilePicture(profilePicture.id)
                    }
                    disabled={disabled}
                  >
                    <div className={settingsStyles.profilePictureImageWrap}>
                      <div className={settingsStyles.profilePictureImageInset}>
                        <Image
                          src={profilePicture.imagePath}
                          alt={profilePicture.name}
                          fill
                          sizes="(max-width: 768px) 140px, 180px"
                          unoptimized
                          className={settingsStyles.profilePictureImage}
                        />
                      </div>
                    </div>
                    <div className={settingsStyles.profilePictureMeta}>
                      <strong>{profilePicture.name}</strong>
                      <span>{formatProfilePictureUnlock(profilePicture)}</span>
                    </div>
                    <span className={settingsStyles.profilePictureAction}>
                      {!sessionUser
                        ? "Sign in to equip"
                        : isSelected
                          ? "Equipped"
                          : savingProfilePictureId === profilePicture.id
                            ? "Saving..."
                            : unlocked
                              ? "Equip"
                              : "Locked"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!profilePicturesReady ? (
            <p className={sharedStyles.muted}>Loading profile pictures...</p>
          ) : null}
          {profilePictureError ? (
            <p className={sharedStyles.error}>{profilePictureError}</p>
          ) : null}
          <p className={sharedStyles.muted}>
            Unlock gates: Elephant and Octupode start available. Red Pander opens
            at Level 3 and Tiger opens at Level 5.
          </p>
        </section>
      </section>
    </main>
  );
}
