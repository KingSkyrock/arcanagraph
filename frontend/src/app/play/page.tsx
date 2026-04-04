import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlayClient } from "./play-client";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Play",
  description: "Create or join a multiplayer lobby in Arcanagraph",
};

export default function PlayPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Multiplayer Lobby</p>
          <h1>Queue the next match.</h1>
          <p className={styles.copy}>
            This route now runs through the same Firebase session, Express API,
            PostgreSQL tables, and websocket backend as the rest of the app.
          </p>
          <div className={styles.links}>
            <Link className={styles.linkButton} href="/">
              Home
            </Link>
            <Link className={styles.linkButton} href="/login">
              Login
            </Link>
          </div>
        </div>

        <div className={styles.board} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <Suspense fallback={<section className={styles.panel}>Loading lobby tools...</section>}>
        <PlayClient />
      </Suspense>
    </main>
  );
}
