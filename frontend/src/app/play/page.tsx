'use client';
import Navbar from '@/components/Navbar';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function BgPattern() {
  // Light blue math symbols
  const items = [
    { s: '∫', x: '6%', y: '20%', r: -15, sz: 32 },
    { s: 'π', x: '11%', y: '58%', r: 10, sz: 30 },
    { s: 'Σ', x: '4%', y: '80%', r: -8, sz: 28 },
    { s: '√', x: '87%', y: '14%', r: 20, sz: 30 },
    { s: '∞', x: '91%', y: '44%', r: -5, sz: 28 },
    { s: 'θ', x: '83%', y: '70%', r: 12, sz: 28 },
    { s: 'Δ', x: '76%', y: '87%', r: -20, sz: 28 },
    { s: '⋆', x: '20%', y: '9%', r: 0, sz: 24 },
    { s: '⋆', x: '74%', y: '24%', r: 0, sz: 24 },
    { s: '◇', x: '92%', y: '82%', r: 15, sz: 26 },
    { s: '</>', x: '15%', y: '34%', r: -10, sz: 22 },
    { s: '○', x: '29%', y: '88%', r: 0, sz: 26 },
    { s: '⊕', x: '55%', y: '6%', r: 0, sz: 22 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {items.map((s, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            color: 'rgba(210, 226, 245, 0.62)',
            fontSize: s.sz,
            fontFamily: 'serif',
            fontWeight: 700,
            transform: `rotate(${s.r}deg)`,
            userSelect: 'none',
          }}
        >
          {s.s}
        </span>
      ))}
    </div>
  );
}

function HoverButton({ children, style = {}, ...props }: any) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        background: '#3d08ff',
        color: '#fff',
        border: 'none',
        borderRadius: 16,
        padding: '16px 0',
        fontWeight: 800,
        fontSize: 18,
        cursor: 'pointer',
        width: '100%',
        fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'all 0.18s',
        boxShadow: hover
          ? '0 8px 24px rgba(59,130,246,0.22)'
          : '0 4px 12px rgba(61,8,255,0.13)',
        transform: hover ? 'translateX(8px)' : 'none',
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...props}
    >
      {children}
    </button>
  );
}

function ModeButton({ children, style, onClick = {}, ...props }: any) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        fontSize: 22,
        padding: '20px 56px',
        borderRadius: 20,
        fontWeight: 800,
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'all 0.18s',
        transform: hover ? 'translateX(8px)' : 'none',
        ...style,
        boxShadow: hover
          ? style.hoverShadow || '0 8px 24px rgba(59,130,246,0.22)'
          : style.boxShadow || '0 4px 12px rgba(61,8,255,0.13)',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function PlayPage() {
  const [step, setStep] = useState('mode');
  const [mode, setMode] = useState<string | null>(null);
  const router = useRouter();

  function goToWebcam() {
    router.push('/webcam');
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #2563eb 0%, #3b82f6 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Navbar />
      <BgPattern />
      <img 
        src="/images/octopus.png" 
        alt="octopus icon" 
        style={{ 
          position: 'absolute', 
          right: '5%', 
          bottom: '5%', 
          width: '320px', 
          zIndex: 5, 
          pointerEvents: 'none' 
        }} 
      />
      <img 
        src="/images/panda.png" 
        alt="panda" 
        style={{ 
          position: 'absolute', 
          left: '2%', 
          bottom: '5%', 
          width: '380px', 
          zIndex: 5, 
          pointerEvents: 'none' 
        }} 
      />      
      <div
        style={{
          paddingTop: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '90%',
            maxWidth: 520,
            minHeight: 460,
            background: 'rgba(255, 255, 255, 0.98)',
            borderRadius: 24,
            border: '2px solid rgba(45,17,217,0.08)',
            boxShadow: '0 12px 48px 0 rgba(59,130,246,0.25), 0 2px 8px rgba(0,0,0,0.10)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 48,
            position: 'relative',
          }}
        >
          {step === 'mode' && (
            <>
              <button
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "'Nunito', system-ui, sans-serif",
                  textDecoration: 'underline',
                }}
                onClick={() => router.push('/')}
              >
                ← Back
              </button>
              <h2
                style={{
                  fontFamily: "'Impact', 'Arial Black', system-ui, sans-serif",
                  fontSize: 48,
                  color: '#2d11d9',
                  marginBottom: 48,
                  letterSpacing: '-0.5px',
                }}
              >
                Choose Mode
              </h2>
              <div style={{ display: 'flex', gap: 24, width: '100%', justifyContent: 'center' }}>
                <ModeButton
                  style={{
                    background: '#3d08ff',
                    boxShadow: '0 8px 24px rgba(61,8,255,0.18)',
                    hoverShadow: '0 12px 32px rgba(61,8,255,0.28)',
                  }}
                  onClick={() => {
                    setMode('solo');
                    setStep('type');
                  }}
                >
                  Solo
                </ModeButton>
                <ModeButton
                  style={{
                    background: '#f59e0b',
                    boxShadow: '0 8px 24px rgba(245,158,11,0.18)',
                    hoverShadow: '0 12px 32px rgba(245,158,11,0.28)',
                  }}
                  onClick={() => {
                    setMode('battle');
                    setStep('type');
                  }}
                >
                  Battle
                </ModeButton>
              </div>
            </>
          )}
          {step === 'type' && (
            <>
              <button
                style={{
                  position: 'absolute',
                  top: 20,
                  left: 20,
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 700,
                  fontFamily: "'Nunito', system-ui, sans-serif",
                  textDecoration: 'underline',
                }}
                onClick={() => {
                  setStep('mode');
                  setMode(null);
                }}
              >
                ← Back
              </button>
              <h2
                style={{
                  fontFamily: "'Impact', 'Arial Black', system-ui, sans-serif",
                  fontSize: 48,
                  color: '#2d11d9',
                  marginBottom: 40,
                  letterSpacing: '-0.5px',
                }}
              >
                Choose Difficulty
              </h2>
              <div style={{ fontWeight: 700, color: '#3d08ff', fontSize: 16, marginBottom: 8, marginLeft: 2 }}>Presets</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 380, marginBottom: 32 }}>
                <HoverButton style={{ background: '#22c55e' }} onClick={goToWebcam}>Shapes</HoverButton>
                <HoverButton style={{ background: '#f59e0b' }} onClick={goToWebcam}>Beginner Functions</HoverButton>
                <HoverButton style={{ background: '#ef4444' }} onClick={goToWebcam}>Advanced Functions</HoverButton>
            </div>
            <div style={{ fontWeight: 700, color: '#3d08ff', fontSize: 16, marginBottom: 8, marginLeft: 2 }}>Custom</div>
            <HoverButton style={{ background: '#a21caf', marginBottom: 0 }} onClick={goToWebcam}>Custom</HoverButton>
            </>
          )}
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
      `}</style>
    </main>
  );
}