'use client';
import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { PlayClient } from './play-client';

function BgPattern() {
  const items = [
    { s: '∫', x: '6%', y: '20%', r: -15, sz: 28 },
    { s: 'π', x: '11%', y: '58%', r: 10, sz: 26 },
    { s: 'Σ', x: '4%', y: '80%', r: -8, sz: 24 },
    { s: '√', x: '87%', y: '14%', r: 20, sz: 26 },
    { s: '∞', x: '91%', y: '44%', r: -5, sz: 24 },
    { s: 'θ', x: '83%', y: '70%', r: 12, sz: 24 },
    { s: 'Δ', x: '76%', y: '87%', r: -20, sz: 24 },
    { s: '⋆', x: '20%', y: '9%', r: 0, sz: 20 },
    { s: '⋆', x: '74%', y: '24%', r: 0, sz: 20 },
    { s: '◇', x: '92%', y: '82%', r: 15, sz: 22 },
    { s: '</>', x: '15%', y: '34%', r: -10, sz: 20 },
    { s: '○', x: '29%', y: '88%', r: 0, sz: 22 },
    { s: '⊕', x: '55%', y: '6%', r: 0, sz: 20 },
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

type Step = 'mode' | 'battle' | 'type' | 'lobby';

const DIFFICULTIES = [
  { id: 'shapes', label: 'Shapes', bg: 'rgb(34, 197, 94)', shadow: 'rgb(21, 128, 61)', hover: 'rgb(22, 163, 74)' },
  { id: 'beginner', label: 'Beginner Functions', bg: 'rgb(245, 158, 11)', shadow: 'rgb(180, 83, 9)', hover: 'rgb(217, 119, 6)' },
  { id: 'advanced', label: 'Advanced Functions', bg: 'rgb(239, 104, 104)', shadow: 'rgb(185, 28, 28)', hover: 'rgb(220, 38, 38)' },
  { id: 'custom', label: 'Custom', bg: 'rgb(162, 28, 175)', shadow: 'rgb(112, 26, 117)', hover: 'rgb(134, 25, 143)' },
] as const;

export default function PlayPage() {
  const [step, setStep] = useState<Step>('mode');
  const [mode, setMode] = useState<'solo' | 'battle' | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const router = useRouter();

  const getLegoStyle = (bg: string, shadow: string, isSmall = false): React.CSSProperties => ({
    textDecoration: 'none',
    background: bg,
    color: 'rgb(255, 255, 255)',
    borderRadius: isSmall ? 16 : 24,
    padding: isSmall ? '18px 40px' : '32px 64px',
    fontWeight: 900,
    fontSize: isSmall ? 18 : 28,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontFamily: "'Nunito', system-ui, sans-serif",
    letterSpacing: '0.5px',
    border: 'none',
    boxShadow: `0 ${isSmall ? 4 : 6}px 0px ${shadow}, 0 4px 12px rgba(0, 0, 0, 0.2)`,
    transition: 'transform 0.1s ease-out, box-shadow 0.1s, background 0.1s',
    width: '100%',
    maxWidth: isSmall ? 380 : 450,
  });

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, shadow: string, isSmall: boolean, hoverBg: string) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = `0 ${isSmall ? 6 : 8}px 0px ${shadow}, 0 8px 16px rgba(0, 0, 0, 0.2)`;
    e.currentTarget.style.background = hoverBg;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>, bg: string, shadow: string, isSmall: boolean) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = `0 ${isSmall ? 4 : 6}px 0px ${shadow}, 0 4px 12px rgba(0, 0, 0, 0.2)`;
    e.currentTarget.style.background = bg;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>, shadow: string) => {
    e.currentTarget.style.transform = 'translateY(4px)';
    e.currentTarget.style.boxShadow = `0 0px 0px ${shadow}, 0 2px 4px rgba(0, 0, 0, 0.2)`;
  };

  function handleDifficultyPick(diff: string) {
    setDifficulty(diff);
    if (mode === 'solo') {
      router.push('/game/solo');
    } else {
      // Battle create: go to lobby with auto-create
      setStep('lobby');
    }
  }

  function goBack() {
    if (step === 'type') {
      setStep(mode === 'battle' ? 'battle' : 'mode');
      setDifficulty(null);
    } else if (step === 'battle') {
      setStep('mode');
      setMode(null);
    } else if (step === 'lobby') {
      setStep('battle');
      setDifficulty(null);
    } else {
      setStep('mode');
      setMode(null);
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%)',
    color: 'rgb(255, 255, 255)',
    position: 'relative',
    overflow: 'hidden',
  };

  const backBtn = (
    <button
      onClick={goBack}
      style={{ marginTop: 40, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: 16 }}
    >
      Back
    </button>
  );

  // Lobby view (battle mode, after create or join)
  if (step === 'lobby') {
    return (
      <main style={{ ...pageStyle, padding: '112px 28px 36px' }}>
        <Navbar />
        <BgPattern />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 900, margin: '0 auto' }}>
          <button
            onClick={goBack}
            style={{ marginBottom: 24, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: 16 }}
          >
            Back to Mode Selection
          </button>
          <Suspense fallback={<div style={{ textAlign: 'center', fontWeight: 700, padding: 48 }}>Loading lobby tools...</div>}>
            <PlayClient
              autoCreateWithDifficulty={difficulty}
              joinInviteCode={joinCode || undefined}
            />
          </Suspense>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <Navbar />
      <BgPattern />

      <img
        src="/images/panda.png"
        alt=""
        style={{
          position: 'absolute', left: '2%', bottom: '5%',
          width: '320px', zIndex: 5, pointerEvents: 'none',
        }}
      />
      <img
        src="/images/logo.png"
        alt=""
        style={{
          position: 'absolute', right: '2%', bottom: '5%',
          width: '380px', zIndex: 5, pointerEvents: 'none',
          mixBlendMode: 'screen', opacity: 0.8,
        }}
      />

      <div style={{
        paddingTop: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* Step 1: Pick mode */}
        {step === 'mode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 56, color: '#fff', marginBottom: 20
            }}>Pick Your Quest</h2>

            <button
              style={getLegoStyle('rgb(228, 111, 166)', 'rgb(216, 29, 85)')}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(228, 111, 166)', false, 'rgb(216, 29, 85)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(228, 111, 166)', 'rgb(216, 29, 85)', false)}
              onMouseDown={e => handleMouseDown(e, 'rgb(228, 111, 166)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(228, 111, 166)', false, 'rgb(216, 29, 85)')}
              onClick={() => { setMode('solo'); setStep('type'); }}
            >
              SOLO
            </button>

            <button
              style={getLegoStyle('rgb(241, 116, 88)', 'rgb(234, 61, 22)')}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(241, 116, 88)', false, 'rgb(234, 61, 22)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(241, 116, 88)', 'rgb(234, 61, 22)', false)}
              onMouseDown={e => handleMouseDown(e, 'rgb(241, 116, 88)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(241, 116, 88)', false, 'rgb(234, 61, 22)')}
              onClick={() => { setMode('battle'); setStep('battle'); }}
            >
              BATTLE
            </button>
          </div>
        )}

        {/* Step 2 (Battle): Create or Join */}
        {step === 'battle' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 48, color: '#fff', marginBottom: 20
            }}>Battle Mode</h2>

            <button
              style={getLegoStyle('rgb(245, 158, 11)', 'rgb(180, 83, 9)')}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(180, 83, 9)', false, 'rgb(217, 119, 6)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(245, 158, 11)', 'rgb(180, 83, 9)', false)}
              onMouseDown={e => handleMouseDown(e, 'rgb(180, 83, 9)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(180, 83, 9)', false, 'rgb(217, 119, 6)')}
              onClick={() => setStep('type')}
            >
              CREATE LOBBY
            </button>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', width: '100%', maxWidth: 450,
            }}>
              <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.2)', margin: '8px 0' }} />
              <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)' }}>
                Or join with invite code
              </span>
              <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 380 }}>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="INVITE CODE"
                  maxLength={6}
                  style={{
                    flex: 1, minHeight: 52, padding: '0 18px',
                    border: '2px solid rgba(255,255,255,0.24)', borderRadius: 16,
                    background: 'rgba(255,255,255,0.14)', color: '#fff',
                    fontWeight: 800, textTransform: 'uppercase', fontSize: 18,
                    textAlign: 'center', letterSpacing: '0.2em',
                  }}
                />
                <button
                  style={{
                    ...getLegoStyle('rgb(59, 130, 246)', 'rgb(29, 78, 216)', true),
                    width: 'auto', maxWidth: 'none', padding: '0 28px',
                  }}
                  onMouseEnter={e => handleMouseEnter(e, 'rgb(29, 78, 216)', true, 'rgb(37, 99, 235)')}
                  onMouseLeave={e => handleMouseLeave(e, 'rgb(59, 130, 246)', 'rgb(29, 78, 216)', true)}
                  onMouseDown={e => handleMouseDown(e, 'rgb(29, 78, 216)')}
                  onMouseUp={e => handleMouseEnter(e, 'rgb(29, 78, 216)', true, 'rgb(37, 99, 235)')}
                  onClick={() => {
                    if (joinCode.trim()) {
                      setDifficulty(null);
                      setStep('lobby');
                    }
                  }}
                  disabled={!joinCode.trim()}
                >
                  JOIN
                </button>
              </div>
            </div>

            {backBtn}
          </div>
        )}

        {/* Difficulty picker (Solo always, Battle when creating) */}
        {step === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 48, color: 'rgb(222, 218, 252)', marginBottom: 40
            }}>Choose Difficulty</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', alignItems: 'center' }}>
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  style={getLegoStyle(d.bg, d.shadow, true)}
                  onMouseEnter={e => handleMouseEnter(e, d.shadow, true, d.hover)}
                  onMouseLeave={e => handleMouseLeave(e, d.bg, d.shadow, true)}
                  onMouseDown={e => handleMouseDown(e, d.shadow)}
                  onMouseUp={e => handleMouseEnter(e, d.shadow, true, d.hover)}
                  onClick={() => handleDifficultyPick(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {backBtn}
          </div>
        )}
      </div>
    </main>
  );
}
