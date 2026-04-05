'use client';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/Footer';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{
        minHeight: '100vh',
        padding: '112px 24px 64px',
        background: 'linear-gradient(180deg, #2563eb 0%, #3b82f6 100%)',
        color: '#fff',
      }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <h1 style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 900,
            marginBottom: 24,
            letterSpacing: '-0.5px',
          }}>
            About Arcanagraph
          </h1>
          <p style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.88)',
            marginBottom: 20,
          }}>
            Arcanagraph is a multiplayer math dueling game where players trace equations
            in the air using hand gestures tracked by their webcam. Draw a perfect sine wave,
            nail a parabola, or trace a cubic. The more accurate your drawing, the more
            damage your spell deals. First player to zero HP loses.
          </p>
          <p style={{
            fontSize: 18,
            lineHeight: 1.7,
            color: 'rgba(255,255,255,0.88)',
            marginBottom: 32,
          }}>
            Built for DiamondHacks 2026 by a team of four students who wanted to make
            math feel like magic. Whether you&apos;re practicing solo or battling a friend,
            Arcanagraph turns graphing into a fast-paced, hands-on challenge.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            <Link
              href="/play"
              style={{
                textDecoration: 'none',
                background: '#f59e0b',
                color: '#fff',
                borderRadius: 50,
                padding: '14px 36px',
                fontWeight: 700,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: '0 4px 0px #b45309, 0 4px 12px rgba(0,0,0,0.2)',
                transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
                e.currentTarget.style.background = '#d97706';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.background = '#f59e0b';
              }}
            >
              Play Now
            </Link>
            <Link
              href="/"
              style={{
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.18)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.24)',
                borderRadius: 50,
                padding: '14px 36px',
                fontWeight: 700,
                fontSize: 16,
                transition: 'background 0.15s, transform 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.28)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
