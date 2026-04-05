'use client';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { Skeleton } from '@/components/Skeleton';
import { HowToPlayModal } from '@/components/HowToPlayModal';
import { apiUrl } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

type LeaderboardEntry = {
  id: string;
  displayName: string | null;
  wins: number;
  losses: number;
  level: number;
  className: string;
  xp: number;
};



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
          color: 'rgba(255, 255, 255, 0.66)',
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
  const [showHelp, setShowHelp] = useState(false);
  const scrollDown = () => document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section className="hero-section">
      <style>{`
        .hero-section {
          min-height: 100vh;
          background-color: #1877f2;
          display: flex;
          align-items: center;
          position: relative;
          overflow: hidden;
          padding-top: 78px;
        }
        .hero-text {
          position: relative;
          z-index: 20;
          padding-left: 20%;
          width: 46%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
        }
        .hero-elephant {
          position: absolute;
          right: 0;
          bottom: 20%;
          width: 54%;
          height: 92%;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          z-index: 5;
          pointer-events: none;
        }
        .hero-elephant img {
          width: 60%;
          height: auto;
          max-width: 580px;
          object-fit: contain;
          object-position: bottom;
          mix-blend-mode: screen;
          filter: brightness(1.05);
          pointer-events: none;
        }
        .hero-scroll {
          position: absolute;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
        }
        @media (max-width: 900px) {
          .hero-text {
            padding-left: 10%;
            width: 55%;
          }
          .hero-elephant {
            width: 45%;
          }
        }
        @media (max-width: 720px) {
          .hero-section {
            flex-direction: column;
            justify-content: center;
            padding: 100px 24px 80px;
          }
          .hero-text {
            padding-left: 0;
            width: 100%;
            align-items: center;
            text-align: center;
          }
          .hero-elephant {
            position: relative;
            right: auto;
            bottom: auto;
            width: 100%;
            height: auto;
            justify-content: center;
            margin-top: -20px;
            margin-bottom: 8px;
            order: -1;
          }
          .hero-elephant img {
            width: 50%;
            max-width: 240px;
          }
          .hero-scroll {
            display: none;
          }
        }
      `}</style>
      <BgPattern />

      <div className="hero-text">
        <h1 style={{
          fontSize: 'clamp(42px, 5.8vw, 84px)',
          fontWeight: 900,
          color: '#fff',
          margin: '0 0 12px',
          lineHeight: 1.05,
          letterSpacing: '-1px',
          fontFamily: "'Impact', 'Arial Black', 'Oswald', system-ui, sans-serif",
        }}>
          Cast Spells<br />with Math
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)', color: 'rgba(255,255,255,0.88)',
          margin: '0 0 24px', fontWeight: 500, lineHeight: 1.55, maxWidth: 700,
        }}>
          Draw math functions in the air with your hands to cast spells and battle your friends.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
          <Link
            href="/play"
            style={{
              textDecoration: 'none',
              background: '#f59e0b',
              color: '#fff',
              borderRadius: 50,
              padding: '16px 44px',
              fontWeight: 800,
              fontSize: 'clamp(16px, 2vw, 18px)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 4px 0px #b45309, 0 4px 12px rgba(0,0,0,0.2)',
              transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 0px #b45309, 0 8px 16px rgba(0,0,0,0.2)';
              e.currentTarget.style.background = '#d97706';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1) translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 0px #b45309, 0 4px 12px rgba(0,0,0,0.2)';
              e.currentTarget.style.background = '#f59e0b';
            }}
          >
            PLAY NOW
            <span style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, lineHeight: 1,
            }}>
              ▶
            </span>
          </Link>

          <button
            onClick={() => setShowHelp(true)}
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.24)',
              borderRadius: 50,
              padding: '12px 36px',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
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
            How to Play?
          </button>
        </div>
      </div>

      <div className="hero-elephant">
        <Image
          src="/images/logo.png"
          alt=""
          aria-hidden="true"
          width={580}
          height={580}
          priority
        />
      </div>

      <button onClick={scrollDown} className="hero-scroll" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.78)',
        fontWeight: 700, fontSize: 15, transition: 'color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.78)'}
      >
        <span>Leaderboard</span>
        <span style={{ fontSize: 24, lineHeight: 1, animation: 'bounce 1.8s ease-in-out infinite' }}>↓</span>
      </button>

      <HowToPlayModal open={showHelp} onClose={() => setShowHelp(false)} />
    </section>
  );
}


function LeaderboardSection() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/leaderboard?limit=7'), { credentials: 'include' })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setEntries(data.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const RANK_LABEL: Record<number, string> = { 0: 'Gold medal', 1: 'Silver medal', 2: 'Bronze medal' };

  return (
    <section id="leaderboard" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '96px 24px', background: 'rgba(180, 191, 239, 0.99)', position: 'relative', zIndex: 10,
    }}>
      <style>{`
        .lb-row { display: grid; grid-template-columns: 48px 1fr 110px 64px; }
        @media (max-width: 600px) {
          .lb-row { grid-template-columns: 36px 1fr 64px; }
          .lb-class { display: none; }
          .lb-header { padding: 12px 16px !important; }
          .lb-cell { padding: 14px 16px !important; }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 820 }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{
            fontSize: 60, fontWeight: 900, color: 'rgb(9, 15, 131)', margin: '0 0 10px',
            fontFamily: " 'Arial Black', 'Oswald', system-ui, sans-serif", letterSpacing: '-1px',
          }}>Leaderboard</h2>
          <p style={{ color: '#64748b', fontSize: 18, fontFamily: "'Nunito', system-ui, sans-serif" }}>
            Top wizards this week
          </p>
        </div>

        <div style={{
          background: '#fff', borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 4px 40px rgba(26,86,219,0.1)', border: '1.5px solid #e2e8f0',
        }}>
          <div className="lb-row lb-header" style={{
            padding: '14px 28px', background: '#1a56db', color: '#fff',
            fontWeight: 800, fontSize: 13, letterSpacing: '0.6px',
            alignItems: 'center',
          }}>
            <span>RANK</span><span>PLAYER</span><span className="lb-class">CLASS</span><span>WINS</span>
          </div>
          {loading ? (
            <div style={{ display: 'grid', gap: 0 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="lb-row lb-cell" style={{
                  padding: '17px 28px', alignItems: 'center',
                  borderBottom: i < 4 ? '1px solid #f1f5f9' : 'none',
                }}>
                  <Skeleton width={24} height={24} borderRadius={6} style={{ background: 'rgba(0,0,0,0.06)' }} />
                  <Skeleton width={120} height={18} borderRadius={8} style={{ background: 'rgba(0,0,0,0.06)' }} />
                  <Skeleton width={80} height={18} borderRadius={8} style={{ background: 'rgba(0,0,0,0.06)' }} className="lb-class" />
                  <Skeleton width={40} height={18} borderRadius={8} style={{ background: 'rgba(0,0,0,0.06)' }} />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p style={{ padding: '32px 28px', color: '#64748b', textAlign: 'center', fontSize: 16 }}>
              No players on the leaderboard yet. Be the first!
            </p>
          ) : (
            entries.map((entry, i) => (
              <div key={entry.id} className="lb-row lb-cell" style={{
                padding: '17px 28px',
                background: i % 2 === 0 ? '#f8fafc' : '#fff',
                borderBottom: i < entries.length - 1 ? '1px solid #f1f5f9' : 'none',
                alignItems: 'center', transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#f8fafc' : '#fff'}
              >
                <span style={{ fontSize: i <= 2 ? 22 : 16, fontWeight: 700, color: '#94a3b8' }}>
                  {i <= 2 ? (
                    <span role="img" aria-label={RANK_LABEL[i]}>
                      {['🥇', '🥈', '🥉'][i]}
                    </span>
                  ) : `#${i + 1}`}
                </span>
                <span style={{ fontWeight: 800, color: '#1e293b', fontSize: 16 }}>
                  {entry.displayName || 'Anonymous'}
                </span>
                <span className="lb-class" style={{ fontWeight: 700, color: '#64748b', fontSize: 14 }}>
                  Lv.{entry.level} {entry.className}
                </span>
                <span style={{ color: '#64748b', fontWeight: 700 }}>
                  {entry.wins}W
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > window.innerHeight);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Scroll to top"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 50,
        width: 48, height: 48, borderRadius: '50%',
        background: '#f59e0b', color: '#fff', border: 'none',
        boxShadow: '0 4px 0 #b45309, 0 4px 12px rgba(0,0,0,0.2)',
        cursor: 'pointer', fontSize: 20, fontWeight: 900,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'transform 0.18s, opacity 0.2s',
        opacity: 0.9,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.opacity = '1'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.opacity = '0.9'; }}
    >
      ↑
    </button>
  );
}

export default function HomePage() {
  return (
    <>
      <Navbar />
      <HeroSection />
      <LeaderboardSection />
      <Footer />
      <ScrollToTop />
    </>
  );
}
