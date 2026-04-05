"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { AppUser, LobbyPlayer } from "@/lib/types";
import Navbar from "@/components/Navbar";
import { formatSkillFamilyLabel } from "../[lobbyId]/graph-battle";
import { GraphBattlePanel } from "../[lobbyId]/graph-battle-panel";
import styles from "../[lobbyId]/page.module.css";

function createGuestLobbyPlayer(): LobbyPlayer {
  return {
    userId: "solo-guest",
    displayName: "Guest Mage",
    xp: 0,
    level: 1,
    className: "Spark",
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    ready: true,
    isHost: true,
    joinedAt: new Date().toISOString(),
  };
}

function userToLobbyPlayer(user: AppUser): LobbyPlayer {
  return {
    userId: user.id,
    displayName: user.displayName,
    xp: user.xp,
    level: user.level,
    className: user.className,
    wins: user.wins,
    losses: user.losses,
    gamesPlayed: user.gamesPlayed,
    ready: true,
    isHost: true,
    joinedAt: new Date().toISOString(),
  };
}

export function SoloGameClient() {
  const searchParams = useSearchParams();
  const [guestPlayer] = useState(createGuestLobbyPlayer);
  const [user, setUser] = useState<AppUser | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const selectedSkillFamily = searchParams.get("skillFamily");
  const selectedCategory = searchParams.get("category") as "beginner" | "advanced" | null;
  const selectedSkillFamilyLabel = selectedSkillFamily
    ? formatSkillFamilyLabel(selectedSkillFamily)
    : null;

  useEffect(() => {
    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then(async (res) => {
        if (res.status === 401) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`Could not load your player session (${res.status}).`);
        }

        return (await res.json()) as { user: AppUser };
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
      })
      .catch((loadError) => {
        console.warn(
          "Solo practice is continuing in guest mode because the player session could not be loaded.",
          loadError,
        );
      })
      .finally(() => {
        setSessionReady(true);
      });
  }, []);

  const player = user ? userToLobbyPlayer(user) : guestPlayer;

  return (
    <main className={styles.page} style={{ paddingTop: 112 }}>
      <Navbar />
      <section className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.kicker}>Solo Practice</p>
          <h1>Practice Mode</h1>
          <p className={styles.copy}>
            {selectedSkillFamilyLabel
              ? `Trace ${selectedSkillFamilyLabel} equations with your hand to practice one graph family at a time.`
              : "Trace equations with your hand to practice your accuracy. No opponents, no pressure."}
          </p>
          {selectedSkillFamilyLabel ? (
            <p className={styles.meta}>Custom focus: {selectedSkillFamilyLabel}</p>
          ) : null}
          <p className={styles.muted}>
            {user
              ? "You are practicing with your signed-in player profile."
              : "Jump in as a guest now, or sign in later if you want your player profile attached."}
          </p>
          <div className={styles.links}>
            <Link className={styles.linkButton} href="/play">
              Back to mode select
            </Link>
            <Link className={styles.linkButton} href="/settings">
              Hand settings
            </Link>
            <Link className={styles.linkButton} href="/">
              Home
            </Link>
          </div>
        </div>

        <GraphBattlePanel
          currentPlayer={player}
          lobbyMatch={null}
          opponents={[]}
          selectedTargetId={null}
          disabled={true}
          solo
          soloSkillFamily={selectedSkillFamily}
          category={selectedCategory}
          sessionUser={user}
          sessionReady={sessionReady}
          onSuccessfulScore={async () => undefined}
        />
      </section>
    </main>
  );
}
