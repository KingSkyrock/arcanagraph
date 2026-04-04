import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Arcanagraph</p>
        <h1>Hackathon auth, leaderboard storage, and multiplayer-ready backend.</h1>
        <p className={styles.copy}>
          Firebase signs players in. Express owns the session cookie. PostgreSQL
          tracks users, wins, losses, games played, XP, and level classes for the upcoming
          leaderboard.
        </p>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">
            Open Login
          </Link>
          <Link className={styles.secondary} href="/play">
            Open Lobby
          </Link>
          <a
            className={styles.secondary}
            href="http://localhost:4000/api/health"
            target="_blank"
            rel="noreferrer"
          >
            Backend Health
          </a>
        </div>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <p>Identity</p>
          <h2>Firebase Auth</h2>
          <span>Email/password auth with emulator support for local testing.</span>
        </article>
        <article className={styles.card}>
          <p>API Layer</p>
          <h2>Express</h2>
          <span>Session cookies and future websocket auth live in one backend.</span>
        </article>
        <article className={styles.card}>
          <p>Persistence</p>
          <h2>PostgreSQL</h2>
          <span>Users store leaderboard stats, XP, and level rank data now.</span>
        </article>
      </section>
    </main>
  );
}
