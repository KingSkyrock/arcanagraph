import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Arcanagraph player account",
};

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className={styles.page} style={{ paddingTop: 112 }}>
        <section className={styles.shell}>
          <div className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.brand}>✦ Arcanagraph</p>
              <h1>Login to the arena.</h1>
              <p className={styles.copy}>
                Sign in or create a player account to track your wins, losses,
                XP, level, and class rank across multiplayer matches.
              </p>
              <div className={styles.heroLinks}>
                <Link className={styles.homeLink} href="/">
                  Back to home
                </Link>
                <Link className={styles.homeLink} href="/play">
                  Play now
                </Link>
              </div>
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
    </>
  );
}
