'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Navbar from '@/components/Navbar'; // Use the shared component
import Link from 'next/link';
import Image from 'next/image';

const LEADERBOARD = [
  { rank: 1, name: 'Zara W.',   division: 'Advanced',     score: 9820, wins: 47 },
  { rank: 2, name: 'Kai T.',    division: 'Advanced',     score: 8740, wins: 41 },
  { rank: 3, name: 'Priya M.',  division: 'Intermediate', score: 7650, wins: 34 },
  { rank: 4, name: 'Leo R.',    division: 'Intermediate', score: 6430, wins: 28 },
  { rank: 5, name: 'Sam H.',    division: 'Beginner',     score: 5210, wins: 19 },
  { rank: 6, name: 'Nina B.',   division: 'Beginner',     score: 4980, wins: 17 },
  { rank: 7, name: 'Omar S.',   division: 'Advanced',     score: 4700, wins: 16 },
];

const DIV_STYLE:Record<string, { bg: string; text: string; border: string }> = {
  Advanced:     { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
  Intermediate: { bg: '#fef9c3', text: '#a16207', border: '#fde047' },
  Beginner:     { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
};
const RANK_ICON:Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };


// Faint background symbols matching the Study.Pilot reference
function BgPattern() {
  const items = [
    { s: '∫',   x: '6%',  y: '20%', r: -15, sz: 28 },
    { s: 'π',   x: '11%', y: '58%', r: 10,  sz: 26 },
    { s: 'Σ',   x: '4%',  y: '80%', r: -8,  sz: 24 },
    { s: '√',   x: '87%', y: '14%', r: 20,  sz: 26 },
    { s: '∞',   x: '91%', y: '44%', r: -5,  sz: 24 },
    { s: 'θ',   x: '83%', y: '70%', r: 12,  sz: 24 },
    { s: 'Δ',   x: '76%', y: '87%', r: -20, sz: 24 },
    { s: '⋆',   x: '20%', y: '9%',  r: 0,   sz: 20 },
    { s: '⋆',   x: '74%', y: '24%', r: 0,   sz: 20 },
    { s: '◇',   x: '92%', y: '82%', r: 15,  sz: 22 },
    { s: '</>',  x: '15%', y: '34%', r: -10, sz: 20 },
    { s: '○',   x: '29%', y: '88%', r: 0,   sz: 22 },
    { s: '⊕',   x: '55%', y: '6%',  r: 0,   sz: 20 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {items.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', left: s.x, top: s.y,
          color: 'rgba(255,255,255,0.13)',
          fontSize: s.sz, fontFamily: 'serif', fontWeight: 700,
          transform: `rotate(${s.r}deg)`, userSelect: 'none',
        }}>{s.s}</span>
      ))}
    </div>
  );
}

/**
 * Hero Section
 * @returns idk
 */
function HeroSection() {
  const scrollDown = () => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section style={{
      minHeight: '100vh',
      // Solid bright blue matching the Study.Pilot reference — no gradient fade
      backgroundColor: '#1877f2',
      display: 'flex', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
      paddingTop: 78,
    }}>
      <BgPattern />

      {/* LEFT: text block, vertically centered slightly below middle like reference */}
      <div style={{
        position: 'relative', zIndex: 20,
        paddingLeft: '20%',
        width: '46%',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      }}>
        {/*
          "Boost Your Child's Future" in the reference uses a very heavy,
          wide, condensed sans — matching Impact / Arial Black style.
          We use Impact with a Google Fonts fallback (Oswald ExtraBold is close).
        */}
        <h1 style={{
          fontSize: 'clamp(54px, 5.8vw, 84px)',
          fontWeight: 900,
          color: '#fff',
          margin: '0 0 24px',
          lineHeight: 1.05,
          letterSpacing: '-1px',
          // Impact is the closest match to the Study.Pilot heading font
          fontFamily: "'Impact', 'Arial Black', 'Oswald', system-ui, sans-serif",
          textTransform: 'none',
        }}>
          Cast Spells<br />with Math
        </h1>

        <p style={{
          fontSize: 18, color: 'rgba(255,255,255,0.88)',
          margin: '0 0 44px', fontWeight: 500, lineHeight: 1.55, maxWidth: 700,
          fontFamily: "'Nunito', system-ui, sans-serif",
        }}>
          Unlocking Potential. Your Partner in<br />
          Cultivating Your Child's Math Journey
        </p>

        {/* PLAY NOW — amber pill with strong drop shadow like reference */}
        <Link
          href="/play"
          style={{
            textDecoration: 'none',
            background: '#f59e0b',
            color: '#fff',
            borderRadius: 50,
            padding: '18px 52px',
            fontWeight: 800,
            fontSize: 18,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            fontFamily: "'Nunito', system-ui, sans-serif",
            letterSpacing: '0.5px',
            boxShadow: '0 8px 28px rgba(245,158,11,0.6), 0 3px 10px rgba(0,0,0,0.25)',
            transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 14px 36px rgba(245,158,11,0.7), 0 6px 16px rgba(0,0,0,0.3)';
            e.currentTarget.style.background = '#d97706';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 28px rgba(245,158,11,0.6), 0 3px 10px rgba(0,0,0,0.25)';
            e.currentTarget.style.background = '#f59e0b';
          }}
        >
          PLAY NOW
          <span
            style={{
              width: 50,
              height: 50,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            ▶
          </span>
        </Link> 
      </div>

      {/* RIGHT: actual uploaded elephant PNG, flush bottom-right */}
      <div style={{
        position: 'absolute', right: '0%', bottom: 0,
        width: '54%', height: '92%',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 5, pointerEvents: 'none',
      }}>
        <img
          src="/images/logo.png"
          alt="Icon Elephant"
          style={{
            width: '60%',
            maxWidth: 580,
            objectFit: 'contain',
            objectPosition: 'bottom',
            // mix-blend-mode screen makes the black background of the PNG transparent
            // so the elephant floats naturally on the blue background
            mixBlendMode: 'screen',
            filter: 'brightness(1.05)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Scroll arrow */}
      <button onClick={scrollDown} style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.78)',
        fontFamily: "'Nunito', system-ui, sans-serif",
        fontWeight: 700, fontSize: 15,
        transition: 'color 0.15s', zIndex: 20,
      }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.78)'}
      >
        <span>Leaderboard</span>
        <ChevronDown size={24} style={{ animation: 'bounce 1.8s ease-in-out infinite' }} />
      </button>

      <style>{`
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(7px)} }
      `}</style>
    </section>
  );
}

function DivBadge({ d }: { d: string }) {
  const c = DIV_STYLE[d] || DIV_STYLE.Beginner;
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      borderRadius: 20, padding: '3px 14px', fontSize: 12, fontWeight: 700,
      fontFamily: "'Nunito', system-ui, sans-serif",
    }}>{d}</span>
  );
}

/**
 * Leaderboard
 * @returns idk
 */

function LeaderboardSection() {
  const [filter, setFilter] = useState('All');
  const tabs = ['All', 'Advanced', 'Intermediate', 'Beginner'];
  const rows = filter === 'All' ? LEADERBOARD : LEADERBOARD.filter(r => r.division === filter);

  return (
    <section id="leaderboard" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '96px 24px', background: '#eef4ff',
    }}>
      <div style={{ width: '100%', maxWidth: 820 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{
            fontSize: 60, fontWeight: 900, color: '#1a56db', margin: '0 0 10px',
            fontFamily: " 'Arial Black', 'Oswald', system-ui, sans-serif", letterSpacing: '-1px',
          }}>Leaderboard</h2>
          <p style={{ color: '#64748b', fontSize: 18, fontFamily: "'Nunito', system-ui, sans-serif" }}>
            Top wizards this week
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setFilter(t)} style={{
              padding: '9px 24px', borderRadius: 50, cursor: 'pointer',
              border: filter === t ? 'none' : '1.5px solid #cbd5e1',
              background: filter === t ? '#1a56db' : '#fff',
              color: filter === t ? '#fff' : '#334155',
              fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
              fontFamily: "'Nunito', system-ui, sans-serif",
            }}>{t}</button>
          ))}
        </div>

        <div style={{
          background: '#fff', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(26,86,219,0.1)', border: '1.5px solid #e2e8f0',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 170px 110px 80px',
            padding: '14px 28px', background: '#1a56db', color: '#fff',
            fontWeight: 800, fontSize: 13, letterSpacing: '0.6px',
            fontFamily: "'Nunito', system-ui, sans-serif",
          }}>
            <span>RANK</span><span>PLAYER</span><span>DIVISION</span><span>SCORE</span><span>WINS</span>
          </div>
          {rows.map((row, i) => (
            <div key={row.rank} style={{
              display: 'grid', gridTemplateColumns: '60px 1fr 170px 110px 80px',
              padding: '17px 28px',
              background: 'transparent',
              borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
              alignItems: 'center', transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#f8fafc' : '#fff'}
            >
              <span style={{ fontSize: row.rank <= 3 ? 22 : 16, fontWeight: 700, color: '#94a3b8' }}>
                {RANK_ICON[row.rank] ?? `#${row.rank}`}
              </span>
              <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 16, fontFamily: "'Nunito', system-ui, sans-serif" }}>
                {row.name}
              </span>
              <DivBadge d={row.division} />
              <span style={{ fontWeight: 800, color: '#1a56db', fontSize: 16, fontFamily: "'Nunito', system-ui, sans-serif" }}>
                {row.score.toLocaleString()}
              </span>
              <span style={{ color: '#64748b', fontWeight: 700, fontFamily: "'Nunito', system-ui, sans-serif" }}>
                {row.wins}W
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Nunito', system-ui, sans-serif; }
      `}</style>
      <Navbar />
      <HeroSection />
      <LeaderboardSection />
    </>
  );
}