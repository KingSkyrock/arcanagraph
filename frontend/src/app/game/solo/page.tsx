"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import type { AppUser, LobbyPlayer } from "@/lib/types";
import Navbar from "@/components/Navbar";
import { GraphBattlePanel } from "../[lobbyId]/graph-battle-panel";
import styles from "../[lobbyId]/page.module.css";

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

export default function SoloGamePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(apiUrl("/api/auth/me"), { credentials: "include" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Not signed in"))))
      .then((data) => setUser(data.user))
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load session."));
  }, []);

  if (error || !user) {
    return (
      <main className={styles.page} style={{ paddingTop: 112 }}>
        <Navbar />
        <section className={styles.panel}>
          <p className={styles.label}>Session required</p>
          <h2>Sign in to practice.</h2>
          <p className={styles.muted}>
            Log in with your Arcanagraph player account to start solo practice.
          </p>
          <Link className={styles.linkButton} href="/login">
            Go to login
          </Link>
          {error && <p className={styles.error}>{error}</p>}
        </section>
      </main>
    );
  }

  const player = userToLobbyPlayer(user);

  return (
    <main className={styles.page} style={{ paddingTop: 112 }}>
      <Navbar />
      <section className={styles.shell}>
        <div className={styles.hero}>
          <p className={styles.kicker}>Solo Practice</p>
          <h1>Practice Mode</h1>
          <p className={styles.copy}>
            Trace equations with your hand to practice your accuracy. No opponents, no pressure.
          </p>
          <div className={styles.links}>
            <Link className={styles.linkButton} href="/play">
              Back to mode select
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
          onSuccessfulScore={async () => undefined}
        />
      </section>
    </main>
  );
}
