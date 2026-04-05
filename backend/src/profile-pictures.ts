import profilePicturesJson from "../../data/profile-pictures.json";

export type ProfilePictureCatalogEntry = {
  id: string;
  imagePath: string;
  name: string;
  unlockLevel: number;
};

const profilePictures = profilePicturesJson as ProfilePictureCatalogEntry[];
const profilePictureMap = new Map(
  profilePictures.map((picture) => [picture.id, picture] as const),
);

export const defaultProfilePictureId =
  profilePictures.find((picture) => picture.unlockLevel <= 1)?.id ??
  profilePictures[0]?.id ??
  "elephant";

export function getProfilePictureById(profilePictureId: unknown) {
  if (typeof profilePictureId !== "string") {
    return null;
  }

  return profilePictureMap.get(profilePictureId) ?? null;
}

export function normalizeProfilePictureId(profilePictureId: unknown) {
  return getProfilePictureById(profilePictureId)?.id ?? defaultProfilePictureId;
}

export function isProfilePictureUnlocked(
  level: number,
  profilePictureId: unknown,
) {
  const picture = getProfilePictureById(profilePictureId);

  if (!picture) {
    return false;
  }

  return level >= picture.unlockLevel;
}
