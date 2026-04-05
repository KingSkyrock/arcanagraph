"use client";

import { apiUrl } from "./api";

export type ProfilePictureCatalogEntry = {
  id: string;
  imagePath: string;
  name: string;
  unlockLevel: number;
};

export function getProfilePictureById(
  profilePictures: ProfilePictureCatalogEntry[],
  profilePictureId: string | null | undefined,
) {
  if (!profilePictureId) {
    return null;
  }

  return (
    profilePictures.find((profilePicture) => profilePicture.id === profilePictureId) ??
    null
  );
}

export function getDefaultProfilePicture(
  profilePictures: ProfilePictureCatalogEntry[],
) {
  return (
    profilePictures.find((profilePicture) => profilePicture.unlockLevel <= 1) ??
    profilePictures[0] ??
    null
  );
}

export async function loadProfilePictureCatalog() {
  const response = await fetch(apiUrl("/data/profile-pictures.json"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Could not load profile pictures.");
  }

  return (await response.json()) as ProfilePictureCatalogEntry[];
}

export function isProfilePictureUnlocked(
  level: number | null | undefined,
  profilePicture: ProfilePictureCatalogEntry,
) {
  return (level ?? 0) >= profilePicture.unlockLevel;
}

export function formatProfilePictureUnlock(profilePicture: ProfilePictureCatalogEntry) {
  return profilePicture.unlockLevel <= 1
    ? "Unlocked by default"
    : `Unlocks at Level ${profilePicture.unlockLevel}`;
}
