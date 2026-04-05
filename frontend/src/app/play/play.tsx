'use client';
import Navbar from '@/components/Navbar';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

function BgPattern() {
  const items = [
    { s: '∫', x: '8%', y: '15%', r: -12, sz: 36 },
    { s: 'π', x: '14%', y: '62%', r: 8, sz: 32 },
    { s: 'Σ', x: '5%', y: '82%', r: -10, sz: 30 },
    { s: '√', x: '88%', y: '12%', r: 18, sz: 34 },
    { s: '∞', x: '92%', y: '48%', r: -6, sz: 30 },
    { s: 'θ', x: '85%', y: '74%', r: 14, sz: 30 },
    { s: 'Δ', x: '78%', y: '88%', r: -18, sz: 30 },
    { s: '⋆', x: '22%', y: '8%', r: 0, sz: 26 },
    { s: '⋆', x: '76%', y: '26%', r: 0, sz: 26 },
    { s: '◇', x: '93%', y: '84%', r: 12, sz: 28 },
    { s: 'f(x)', x: '16%', y: '38%', r: -8, sz: 24 },
    { s: '○', x: '31%', y: '90%', r: 0, sz: 28 },
    { s: '⊕', x: '57%', y: '5%', r: 0, sz: 24 },
    { s: 'α', x: '42%', y: '18%', r: 15, sz: 28 },
    { s: '≈', x: '68%', y: '56%', r: -5, sz: 26 },
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
            color: 'rgba(147,197,253,0.18)',
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

// Fixed: Added : any type and default style object
function HoverButton({ children, style = {}, ...props }: any) {
  const [hover, setHover] = useState(false);
  return (
    <button
      style={{
        background: '#1d4ed8',
        color: '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '18px 0',
        fontWeight: 700,
        fontSize: 17,
        cursor: 'pointer',
        width: '100%',
        fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: hover
          ? '0 10px 30px rgba(29,78,216,0.25), 0 4px 12px rgba(0,0,0,0.15)'
          : '0 4px 14px rgba(29,78,216,0.15)',
        transform: hover ? 'translateY(-2px) scale(1.02)' : 'none',
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

// Fixed: Added : any type
function ModeCard({ icon, title, description, color, onClick }: any) {
  const [hover, setHover] = useState(false);
  
  const colors: any = {
    purple: {
      bg: '#7c3aed',
      hover: '#6d28d9',
      shadow: 'rgba(124,58,237,0.2)',
      hoverShadow: 'rgba(124,58,237,0.35)',
    },
    orange: {
      bg: '#f59e0b',
      hover: '#d97706',
      shadow: 'rgba(245,158,11,0.2)',
      hoverShadow: 'rgba(245,158,11,0.35)',
    },
  };

  const c = colors[color];

  return (
    <button
      style={{
        background: hover ? c.hover : c.bg,
        color: '#fff',
        border: 'none',
        borderRadius: 16,
        padding: '32px 24px',
        cursor: 'pointer',
        fontFamily: "'Nunito', system-ui, sans-serif",
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: hover
          ? `0 12px 36px ${c.hoverShadow}, 0 4px 14px rgba(0,0,0,0.2)`
          : `0 8px 24px ${c.shadow}`,
        transform: hover ? 'translateY(-4px) scale(1.03)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        minWidth: 180,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.5px' }}>{title}</div>
      <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.92, lineHeight: 1.4 }}>
        {description}
      </div>
    </button>
  );
}

export default function PlayPage() {
  const [step, setStep] = useState('mode');
  // Fixed: Added <string | null> so it can accept 'solo' or 'battle'
  const [mode, setMode] = useState<string | null>(null);
  const router = useRouter();

  function goToWebcam() {
    router.push('/webcam');
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <Navbar />
      <BgPattern />
      <div
        style={{
          paddingTop: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 10,
          padding: '100px 24px 60px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: step === 'mode' ? 680 : 560,
            minHeight: step === 'mode' ? 420 : 520,
            background: 'rgba(255, 255, 255, 0.97)',
            borderRadius: 28,
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 8px 24px rgba(30,64,175,0.2)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: step === 'mode' ? '56px 48px' : '56px 44px',
            position: 'relative',
            transition: 'all 0.3s ease-out',
          }}
        >
          <button
            style={{
              position: 'absolute',
              top: 24,
              left: 24,
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Nunito', system-ui, sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color 0.15s',
            }}
            onClick={() => {
              if (step === 'type') {
                setStep('mode');
                setMode(null);
              } else {
                router.push('/');
              }
            }}
            onMouseEnter={(e: any) => e.currentTarget.style.color = '#1e293b'}
            onMouseLeave={(e: any) => e.currentTarget.style.color = '#64748b'}
          >
            ← Back
          </button>

          {step === 'mode' && (
            <>
              <div style={{ textAlign: 'center', marginBottom: 44 }}>
                <h2
                  style={{
                    fontFamily: "'Impact', 'Arial Black', system-ui, sans-serif",
                    fontSize: 52,
                    color: '#1e40af',
                    marginBottom: 12,
                    letterSpacing: '-0.5px',
                  }}
                >
                  Choose Your Mode
                </h2>
                <p style={{
                  color: '#64748b',
                  fontSize: 16,
                  fontWeight: 500,
                  fontFamily: "'Nunito', system-ui, sans-serif",
                }}>
                  Select how you want to practice
                </p>
              </div>
              <div style={{ display: 'flex', gap: 24, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                <ModeCard
                  icon="🧙"
                  title="Solo"
                  description="Practice at your own pace"
                  color="purple"
                  onClick={() => {
                    setMode('solo');
                    setStep('type');
                  }}
                />
                <ModeCard
                  icon="⚔️"
                  title="Battle"
                  description="Compete with others"
                  color="orange"
                  onClick={() => {
                    setMode('battle');
                    setStep('type');
                  }}
                />
              </div>
            </>
          )}

          {step === 'type' && (
            <>
              <h2
                style={{
                  fontFamily: "'Impact', 'Arial Black', system-ui, sans-serif",
                  fontSize: 48,
                  color: '#1e40af',
                  marginBottom: 36,
                  letterSpacing: '-0.5px',
                  textAlign: 'center',
                }}
              >
                Choose Content
              </h2>
              
              <div style={{ width: '100%', maxWidth: 420, marginBottom: 36 }}>
                <div style={{
                  fontWeight: 700,
                  color: '#1e40af',
                  fontSize: 15,
                  marginBottom: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: "'Nunito', system-ui, sans-serif",
                }}>
                  Preset Topics
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <HoverButton onClick={goToWebcam}>✨ Shapes</HoverButton>
                  <HoverButton onClick={goToWebcam}>📊 Beginner Functions</HoverButton>
                  <HoverButton onClick={goToWebcam}>🚀 Advanced Functions</HoverButton>
                </div>
              </div>

              <div style={{ width: '100%', maxWidth: 420 }}>
                <div style={{
                  fontWeight: 700,
                  color: '#1e40af',
                  fontSize: 15,
                  marginBottom: 14,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: "'Nunito', system-ui, sans-serif",
                }}>
                  Build Your Own
                </div>
                <HoverButton
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                    marginBottom: 0,
                  }}
                  onClick={goToWebcam}
                >
                  🎨 Create Custom Challenge
                </HoverButton>
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
      `}</style>
    </main>
  );
}