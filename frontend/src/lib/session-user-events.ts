"use client";

import type { AppUser } from "./types";

const sessionUserUpdatedEventName = "arcanagraph:session-user-updated";

export function emitSessionUserUpdated(user: AppUser | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(sessionUserUpdatedEventName, {
      detail: user,
    }),
  );
}

export function subscribeToSessionUserUpdates(
  listener: (user: AppUser | null) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleUpdate = (event: Event) => {
    const customEvent = event as CustomEvent<AppUser | null>;
    listener(customEvent.detail ?? null);
  };

  window.addEventListener(sessionUserUpdatedEventName, handleUpdate);

  return () => {
    window.removeEventListener(sessionUserUpdatedEventName, handleUpdate);
  };
}
