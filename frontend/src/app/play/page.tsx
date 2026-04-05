import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import { PlayClient } from "./play-client";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Play",
  description: "Create or join a multiplayer lobby in Arcanagraph",
};

const PATTERN_ITEMS = [
  { symbol: "∫", x: "6%", y: "20%", rotation: -15, size: 28 },
  { symbol: "π", x: "11%", y: "58%", rotation: 10, size: 26 },
  { symbol: "Σ", x: "4%", y: "80%", rotation: -8, size: 24 },
  { symbol: "√", x: "87%", y: "14%", rotation: 20, size: 26 },
  { symbol: "∞", x: "91%", y: "44%", rotation: -5, size: 24 },
  { symbol: "θ", x: "83%", y: "70%", rotation: 12, size: 24 },
  { symbol: "Δ", x: "76%", y: "87%", rotation: -20, size: 24 },
  { symbol: "⋆", x: "20%", y: "9%", rotation: 0, size: 20 },
  { symbol: "⋆", x: "74%", y: "24%", rotation: 0, size: 20 },
  { symbol: "◇", x: "92%", y: "82%", rotation: 15, size: 22 },
  { symbol: "</>", x: "15%", y: "34%", rotation: -10, size: 20 },
  { symbol: "○", x: "29%", y: "88%", rotation: 0, size: 22 },
  { symbol: "⊕", x: "55%", y: "6%", rotation: 0, size: 20 },
];

function BgPattern() {
  return (
    <div className={styles.pattern} aria-hidden="true">
      {PATTERN_ITEMS.map((item) => (
        <span
          key={`${item.symbol}-${item.x}-${item.y}`}
          className={styles.patternSymbol}
          style={
            {
              left: item.x,
              top: item.y,
              fontSize: `${item.size}px`,
              transform: `rotate(${item.rotation}deg)`,
            } as React.CSSProperties
          }
        >
          {item.symbol}
        </span>
      ))}
    </div>
  );
}

export default function PlayPage() {
  return (
    <>
      <Navbar />
      <main className={styles.page}>
        <BgPattern />
        <div className={styles.topGlow} aria-hidden="true" />
        <div className={styles.bottomGlow} aria-hidden="true" />

        <Image
          src="/images/panda.png"
          alt=""
          aria-hidden="true"
          width={260}
          height={260}
          className={styles.mascotLeft}
          priority
        />
        <Image
          src="/images/logo.png"
          alt=""
          aria-hidden="true"
          width={360}
          height={360}
          className={styles.mascotRight}
          priority
        />

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Multiplayer Lobby</p>
            <h1>Pick your quest, then queue the duel.</h1>
            <p className={styles.copy}>
              The UI from this branch now sits on top of the current live lobby flow, so create,
              join, ready up, and launch all still run through the same Firebase session, Express
              API, PostgreSQL records, and socket updates.
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

          <div className={styles.heroRail}>
            <div className={styles.heroCard}>
              <span>Battle loop</span>
              <strong>Create, invite, ready, launch.</strong>
              <p>We preserved the real lobby mechanics and just lifted the presentation.</p>
            </div>
            <div className={styles.heroCard}>
              <span>Realtime</span>
              <strong>Socket-backed party state</strong>
              <p>Invite codes, ready states, and game launch still sync live for everyone.</p>
            </div>
            <div className={styles.tileCluster} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </section>

        <Suspense
          fallback={
            <section className={`${styles.panel} ${styles.loadingPanel}`}>
              Loading lobby tools...
            </section>
          }
        >
          <PlayClient />
        </Suspense>
      </main>
    </>
  );
}
