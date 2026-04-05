'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
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

export default function PlayPage() {
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState<string | null>(null);
  const router = useRouter();

  function goToWebcam() {
    router.push('/computervision');
  }

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

  // Battle mode shows the lobby flow
  if (mode === 'battle' && step === 'lobby') {
    return (
      <main style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%)',
        color: 'rgb(255, 255, 255)',
        position: 'relative',
        overflow: 'hidden',
        padding: '112px 28px 36px',
      }}>
        <Navbar />
        <BgPattern />
        <div style={{ position: 'relative', zIndex: 10, maxWidth: 900, margin: '0 auto' }}>
          <button
            onClick={() => { setStep('mode'); setMode(null); }}
            style={{ marginBottom: 24, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline', fontSize: 16 }}
          >
            Back to Mode Selection
          </button>
          <Suspense fallback={<div style={{ textAlign: 'center', fontWeight: 700, padding: 48 }}>Loading lobby tools...</div>}>
            <PlayClient />
          </Suspense>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, rgb(37, 99, 235) 0%, rgb(59, 130, 246) 100%)',
      color: 'rgb(255, 255, 255)',
      position: 'relative',
      overflow: 'hidden',
    }}>
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
        {step === 'mode' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 56, color: 'rgb(255, 255, 255)', marginBottom: 20
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
              onClick={() => { setMode('battle'); setStep('type'); }}
            >
              BATTLE
            </button>
          </div>
        )}

        {step === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontFamily: "'Impact', 'Arial Black', sans-serif",
              fontSize: 48, color: 'rgb(222, 218, 252)', marginBottom: 40
            }}>Choose Difficulty</h2>

            <div style={{ fontWeight: 700, color: 'rgb(248, 247, 250)', fontSize: 16, marginBottom: 8, width: '100%', maxWidth: 380 }}>Presets</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', alignItems: 'center', marginBottom: 32 }}>

              <button
                style={getLegoStyle('rgb(34, 197, 94)', 'rgb(21, 128, 61)', true)}
                onMouseEnter={e => handleMouseEnter(e, 'rgb(21, 128, 61)', true, 'rgb(22, 163, 74)')}
                onMouseLeave={e => handleMouseLeave(e, 'rgb(34, 197, 94)', 'rgb(21, 128, 61)', true)}
                onMouseDown={e => handleMouseDown(e, 'rgb(21, 128, 61)')}
                onMouseUp={e => handleMouseEnter(e, 'rgb(21, 128, 61)', true, 'rgb(22, 163, 74)')}
                onClick={() => mode === 'battle' ? setStep('lobby') : goToWebcam()}
              >Shapes</button>

              <button
                style={getLegoStyle('rgb(245, 158, 11)', 'rgb(180, 83, 9)', true)}
                onMouseEnter={e => handleMouseEnter(e, 'rgb(180, 83, 9)', true, 'rgb(217, 119, 6)')}
                onMouseLeave={e => handleMouseLeave(e, 'rgb(245, 158, 11)', 'rgb(180, 83, 9)', true)}
                onMouseDown={e => handleMouseDown(e, 'rgb(180, 83, 9)')}
                onMouseUp={e => handleMouseEnter(e, 'rgb(180, 83, 9)', true, 'rgb(217, 119, 6)')}
                onClick={() => mode === 'battle' ? setStep('lobby') : goToWebcam()}
              >Beginner Functions</button>

              <button
                style={getLegoStyle('rgb(239, 104, 104)', 'rgb(185, 28, 28)', true)}
                onMouseEnter={e => handleMouseEnter(e, 'rgb(185, 28, 28)', true, 'rgb(220, 38, 38)')}
                onMouseLeave={e => handleMouseLeave(e, 'rgb(239, 104, 104)', 'rgb(185, 28, 28)', true)}
                onMouseDown={e => handleMouseDown(e, 'rgb(185, 28, 28)')}
                onMouseUp={e => handleMouseEnter(e, 'rgb(185, 28, 28)', true, 'rgb(220, 38, 38)')}
                onClick={() => mode === 'battle' ? setStep('lobby') : goToWebcam()}
              >Advanced Functions</button>
            </div>

            <div style={{ fontWeight: 700, color: 'rgb(224, 224, 242)', fontSize: 16, marginBottom: 8, width: '100%', maxWidth: 380 }}>Custom</div>

            <button
              style={getLegoStyle('rgb(162, 28, 175)', 'rgb(112, 26, 117)', true)}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(112, 26, 117)', true, 'rgb(134, 25, 143)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(162, 28, 175)', 'rgb(112, 26, 117)', true)}
              onMouseDown={e => handleMouseDown(e, 'rgb(112, 26, 117)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(112, 26, 117)', true, 'rgb(134, 25, 143)')}
              onClick={() => mode === 'battle' ? setStep('lobby') : goToWebcam()}
            >Custom</button>

            <button
              onClick={() => { setStep('mode'); setMode(null); }}
              style={{ marginTop: 40, background: 'none', border: 'none', color: 'rgb(255, 255, 255)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              Back to Mode Selection
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
