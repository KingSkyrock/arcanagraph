import type { Metadata } from "next";
import Link from "next/link";
import { CustomizerDemo } from "./customizer-demo";
import { DemoClient } from "./demo-client";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Demo",
  description: "Particle and character demo sandbox for Arcanagraph",
};

export default function DemoPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>FX Sandbox</p>
          <h1>Spellcast demo arena.</h1>
          <p className={styles.copy}>
            Two opposing facecam panels, tsParticles spell effects, timed
            damage flashes, randomized motion for wand-cast previews, and an
            8-bit character customizer with carousel gear selection.
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
      </section>

      <DemoClient />
      <CustomizerDemo />
    </main>
  );
}
