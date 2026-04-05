import Navbar from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', padding: '64px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            marginBottom: 24,
            color: '#1a56db',
            fontFamily: "'Arial Black', 'Oswald', system-ui, sans-serif"
          }}>
            About Arcanagraph
          </h1>
          <p style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: '#334155',
            fontFamily: "'Nunito', system-ui, sans-serif",
            marginBottom: 20,
          }}>
            Arcanagraph is a multiplayer math dueling game where players trace equations
            in the air using hand gestures tracked by their webcam. Draw a perfect sine wave,
            nail a parabola, or trace a cubic — the more accurate your drawing, the more
            damage your spell deals. First player to zero HP loses.
          </p>
          <p style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: '#334155',
            fontFamily: "'Nunito', system-ui, sans-serif",
            marginBottom: 20,
          }}>
            Built for DiamondHacks 2026 by a team of four students who wanted to make
            math feel like magic. Whether you&apos;re practicing solo or battling a friend,
            Arcanagraph turns graphing into a fast-paced, hands-on challenge.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
