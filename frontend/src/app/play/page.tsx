'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { apiUrl } from '@/lib/api';
import Navbar from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import {
  formatSkillFamilyLabel,
  listSkillFamilies,
  parseEquationCsv,
} from '../game/[lobbyId]/graph-battle';
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
  const [customSkillFamilies, setCustomSkillFamilies] = useState<
    Array<{ id: string; label: string; count: number }>
  >([]);
  const [customLoading, setCustomLoading] = useState(false);
  const [customError, setCustomError] = useState('');
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const router = useRouter();

  useEffect(() => {
    const activeLobbyId = new URLSearchParams(window.location.search).get('lobby');

    if (activeLobbyId) {
      setMode('battle');
      setStep('lobby');
    }
  }, []);

  function goToSolo(options?: { skillFamily?: string; category?: string }) {
    const params = new URLSearchParams();

    if (options?.skillFamily) {
      params.set('skillFamily', options.skillFamily);
    }
    if (options?.category) {
      params.set('category', options.category);
    }

    router.push(params.size ? `/game/solo?${params.toString()}` : '/game/solo');
  }

  async function openCustomSolo() {
    if (customSkillFamilies.length) {
      setStep('custom');
      return;
    }

    setCustomLoading(true);
    setCustomError('');

    try {
      const response = await fetch(apiUrl('/data/advanced_equations.csv'), {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(
          `Could not load custom skill families (${response.status}).`,
        );
      }

      const csv = await response.text();
      const families = parseEquationCsv(csv);
      const familyIds = listSkillFamilies(families);

      if (!familyIds.length) {
        throw new Error(
          'The advanced equation bank does not contain any skill families yet.',
        );
      }

      const counts = families.reduce<Record<string, number>>((accumulator, family) => {
        const id = family.skill_family.trim();

        if (!id) {
          return accumulator;
        }

        accumulator[id] = (accumulator[id] ?? 0) + 1;
        return accumulator;
      }, {});

      setCustomSkillFamilies(
        familyIds.map((id) => ({
          id,
          label: formatSkillFamilyLabel(id),
          count: counts[id] ?? 0,
        })),
      );
      setStep('custom');
    } catch (loadError) {
      setCustomError(
        loadError instanceof Error
          ? loadError.message
          : 'Could not load custom skill families.',
      );
    } finally {
      setCustomLoading(false);
    }
  }

  const getLegoStyle = (bg: string, shadow: string, isSmall = false): React.CSSProperties => ({
    textDecoration: 'none',
    background: bg,
    color: 'rgb(255, 255, 255)',
    borderRadius: isSmall ? 20 : 24,
    padding: isSmall ? '24px 52px' : '32px 64px',
    fontWeight: 900,
    fontSize: isSmall ? 22 : 28,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    fontFamily: "'Nunito', system-ui, sans-serif",
    letterSpacing: '0.5px',
    border: 'none',
    boxShadow: `0 ${isSmall ? 5 : 6}px 0px ${shadow}, 0 4px 12px rgba(0, 0, 0, 0.2)`,
    transition: 'transform 0.1s ease-out, box-shadow 0.1s, background 0.1s',
    width: '100%',
    maxWidth: isSmall ? 420 : 450,
  });

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, shadow: string, isSmall: boolean, hoverBg: string) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = `0 ${isSmall ? 7 : 8}px 0px ${shadow}, 0 8px 16px rgba(0, 0, 0, 0.2)`;
    e.currentTarget.style.background = hoverBg;
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>, bg: string, shadow: string, isSmall: boolean) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = `0 ${isSmall ? 5 : 6}px 0px ${shadow}, 0 4px 12px rgba(0, 0, 0, 0.2)`;
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
            <PlayClient
              autoCreateWithDifficulty={difficulty}
              joinInviteCode={joinCode || undefined}
              onClose={() => { setDifficulty(null); setJoinCode(''); setStep('createOrJoin'); }}
            />
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

      {/* Background Animals */}
      <img 
        src="/images/octopus.png" 
        alt=""
        aria-hidden="true" 
        style={{ 
          position: 'absolute', right: '10%', bottom: '20%', 
          width: '380px', zIndex: 5, pointerEvents: 'none', animation: 'octopus-float 3.2s ease-in-out infinite'
        }} 
      />
      <style>{`
        @keyframes octopus-float {
            0% { transform: translateY(0); }
            50% { transform: translateY(-100px); }
            100% { transform: translateY(0); }
        }
      `}</style>

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
              fontWeight: 900,
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
              onClick={() => { setMode('battle'); setStep('createOrJoin'); }}
            >
              BATTLE
            </button>
            <button 
            onClick={() => router.push('/')}
            style={{ marginTop: 40, background: 'none', border: 'none', color: 'rgb(255, 255, 255)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
            Back to Home Page
            </button>
          </div>
        )}

        {step === 'createOrJoin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontWeight: 900,
              fontSize: 48, color: 'rgb(255, 255, 255)', marginBottom: 20
            }}>Battle Mode</h2>

            <button
              style={getLegoStyle('rgb(34, 197, 94)', 'rgb(21, 128, 61)')}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(21, 128, 61)', false, 'rgb(22, 163, 74)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(34, 197, 94)', 'rgb(21, 128, 61)', false)}
              onMouseDown={e => handleMouseDown(e, 'rgb(21, 128, 61)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(21, 128, 61)', false, 'rgb(22, 163, 74)')}
              onClick={() => setStep('type')}
            >
              CREATE LOBBY
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: 380 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.24)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>or join with code</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.24)' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="INVITE CODE"
                  maxLength={6}
                  style={{
                    flex: 1, minHeight: 52, padding: '0 16px',
                    border: '1px solid rgba(255,255,255,0.24)', borderRadius: 16,
                    background: 'rgba(255,255,255,0.14)', color: '#fff',
                    fontWeight: 700, fontSize: 18, textTransform: 'uppercase',
                    textAlign: 'center', letterSpacing: '0.15em',
                  }}
                />
                <button
                  style={{ ...getLegoStyle('rgb(241, 116, 88)', 'rgb(234, 61, 22)', true), minWidth: 100 }}
                  onMouseEnter={e => handleMouseEnter(e, 'rgb(234, 61, 22)', true, 'rgb(200, 50, 18)')}
                  onMouseLeave={e => handleMouseLeave(e, 'rgb(241, 116, 88)', 'rgb(234, 61, 22)', true)}
                  onMouseDown={e => handleMouseDown(e, 'rgb(234, 61, 22)')}
                  onMouseUp={e => handleMouseEnter(e, 'rgb(234, 61, 22)', true, 'rgb(200, 50, 18)')}
                  disabled={joinCode.trim().length < 4}
                  onClick={() => { setStep('lobby'); }}
                >
                  JOIN
                </button>
              </div>
            </div>

            <button
              onClick={() => { setStep('mode'); setMode(null); }}
              style={{ marginTop: 20, background: 'none', border: 'none', color: 'rgb(255, 255, 255)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              Back to Mode Selection
            </button>
          </div>
        )}

        {step === 'type' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontWeight: 900,
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
                onClick={() => { if (mode === 'battle') { setDifficulty('shapes'); setStep('lobby'); } else goToSolo(); }}
                disabled
              >Shapes (coming soon)</button>

              <button
                style={getLegoStyle('rgb(245, 158, 11)', 'rgb(180, 83, 9)', true)}
                onMouseEnter={e => handleMouseEnter(e, 'rgb(180, 83, 9)', true, 'rgb(217, 119, 6)')}
                onMouseLeave={e => handleMouseLeave(e, 'rgb(245, 158, 11)', 'rgb(180, 83, 9)', true)}
                onMouseDown={e => handleMouseDown(e, 'rgb(180, 83, 9)')}
                onMouseUp={e => handleMouseEnter(e, 'rgb(180, 83, 9)', true, 'rgb(217, 119, 6)')}
                onClick={() => { if (mode === 'battle') { setDifficulty('beginner'); setStep('lobby'); } else goToSolo({ category: 'beginner' }); }}
              >Beginner Functions</button>

              <button
                style={getLegoStyle('rgb(239, 104, 104)', 'rgb(185, 28, 28)', true)}
                onMouseEnter={e => handleMouseEnter(e, 'rgb(185, 28, 28)', true, 'rgb(220, 38, 38)')}
                onMouseLeave={e => handleMouseLeave(e, 'rgb(239, 104, 104)', 'rgb(185, 28, 28)', true)}
                onMouseDown={e => handleMouseDown(e, 'rgb(185, 28, 28)')}
                onMouseUp={e => handleMouseEnter(e, 'rgb(185, 28, 28)', true, 'rgb(220, 38, 38)')}
                onClick={() => { if (mode === 'battle') { setDifficulty('advanced'); setStep('lobby'); } else goToSolo({ category: 'advanced' }); }}
              >Advanced Functions</button>
            </div>

            <div style={{ fontWeight: 700, color: 'rgb(224, 224, 242)', fontSize: 16, marginBottom: 8, width: '100%', maxWidth: 380 }}>Custom</div>

            <button
              style={getLegoStyle('rgb(162, 28, 175)', 'rgb(112, 26, 117)', true)}
              onMouseEnter={e => handleMouseEnter(e, 'rgb(112, 26, 117)', true, 'rgb(134, 25, 143)')}
              onMouseLeave={e => handleMouseLeave(e, 'rgb(162, 28, 175)', 'rgb(112, 26, 117)', true)}
              onMouseDown={e => handleMouseDown(e, 'rgb(112, 26, 117)')}
              onMouseUp={e => handleMouseEnter(e, 'rgb(112, 26, 117)', true, 'rgb(134, 25, 143)')}
              onClick={() => void openCustomSolo()}
              disabled={customLoading}
            >{customLoading ? 'Loading...' : 'Custom'}</button>

            {customError ? (
              <p style={{
                marginTop: 16,
                maxWidth: 420,
                textAlign: 'center',
                color: 'rgb(255, 235, 235)',
                fontWeight: 700,
                lineHeight: 1.5,
              }}>
                {customError}
              </p>
            ) : null}

            <button
              onClick={() => { if (mode === 'battle') { setStep('createOrJoin'); } else { setStep('mode'); setMode(null); } }}
              style={{ marginTop: 40, background: 'none', border: 'none', color: 'rgb(255, 255, 255)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              {mode === 'battle' ? 'Back to Create or Join' : 'Back to Mode Selection'}
            </button>
          </div>
        )}

        {step === 'custom' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <h2 style={{
              fontWeight: 900,
              fontSize: 48, color: 'rgb(222, 218, 252)', marginBottom: 18,
            }}>Choose Skill Family</h2>

            <p style={{
              maxWidth: 520,
              textAlign: 'center',
              color: 'rgb(240, 240, 255)',
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.6,
              marginBottom: 28,
            }}>
              {mode === 'battle'
                ? 'Choose a skill family for your lobby. Both players will get equations from this category.'
                : 'Custom practice will only pull equations from the skill family you choose here.'}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 18,
              width: 'min(100%, 760px)',
            }}>
              {customSkillFamilies.map((family, index) => {
                const palette = [
                  ['rgb(34, 197, 94)', 'rgb(21, 128, 61)', 'rgb(22, 163, 74)'],
                  ['rgb(245, 158, 11)', 'rgb(180, 83, 9)', 'rgb(217, 119, 6)'],
                  ['rgb(239, 104, 104)', 'rgb(185, 28, 28)', 'rgb(220, 38, 38)'],
                  ['rgb(162, 28, 175)', 'rgb(112, 26, 117)', 'rgb(134, 25, 143)'],
                ] as const;
                const [bg, shadow, hoverBg] = palette[index % palette.length] ?? palette[0];

                return (
                  <button
                    key={family.id}
                    style={{
                      ...getLegoStyle(bg, shadow, true),
                      flexDirection: 'column',
                      minHeight: 118,
                      padding: '22px 24px',
                    }}
                    onMouseEnter={e => handleMouseEnter(e, shadow, true, hoverBg)}
                    onMouseLeave={e => handleMouseLeave(e, bg, shadow, true)}
                    onMouseDown={e => handleMouseDown(e, shadow)}
                    onMouseUp={e => handleMouseEnter(e, shadow, true, hoverBg)}
                    onClick={() => {
                      if (mode === 'battle') {
                        setDifficulty(family.id);
                        setStep('lobby');
                      } else {
                        goToSolo({ skillFamily: family.id });
                      }
                    }}
                  >
                    <span>{family.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.84 }}>
                      {family.count} templates
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setStep('type')}
              style={{ marginTop: 40, background: 'none', border: 'none', color: 'rgb(255, 255, 255)', cursor: 'pointer', fontWeight: 700, textDecoration: 'underline' }}
            >
              Back to Difficulty Selection
            </button>
          </div>
        )}
      </div>
        <Footer />
    </main>
  );
}
