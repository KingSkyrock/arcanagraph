import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Arcanagraph player account",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.brand}>✦ Component 1</p>
            <h1>Login to the arena.</h1>
            <p className={styles.copy}>
              Neon auth for the demo now, shared sessions for multiplayer
              sockets next. User records now track wins, losses, games played,
              XP, level, and class rank.
            </p>
            <Link className={styles.homeLink} href="/">
              Back to home
            </Link>
          </div>

          <div className={styles.blockField} aria-hidden="true">
            <span className={styles.blockOne} />
            <span className={styles.blockTwo} />
            <span className={styles.blockThree} />
            <span className={styles.blockFour} />
            <span className={styles.blockFive} />
            <span className={styles.blockSix} />
            <span className={styles.blockSeven} />
            <span className={styles.blockEight} />
            <span className={styles.blockNine} />
            <span className={styles.blockTen} />
            <span className={styles.blockEleven} />
            <span className={styles.blockTwelve} />
          </div>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
