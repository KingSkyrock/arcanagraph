'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { apiUrl } from '@/lib/api';
import { firebaseConfigReady, getFirebaseAuth } from '@/lib/firebase-client';

type SessionUser = { id: string; displayName?: string; email?: string } | null;

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(null);
  const [checked, setChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
      if (firebaseConfigReady()) {
        await signOut(getFirebaseAuth());
      }
      setUser(null);
      router.push('/');
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setLoggingOut(false);
    }
  }

  function handlePlayNowClick(e: React.MouseEvent) {
    if (!user) {
      e.preventDefault();
      router.push('/login');
    }
  }

  return (
    <nav style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 48px',
      height: 78,
      background: '#0f1f4b',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* LEFT: Logo & Brand Name */}
      <Link href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          cursor: 'pointer',
          padding: '8px 12px',
          borderRadius: '4px',
          transition: 'background 0.2s ease, transform 0.1s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.transform = 'scale(1.02)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <Image
          src="/images/logo.png"
          alt="Arcanagraph Home"
          width={80}
          height={60}
          style={{ objectFit: 'contain' }}
        />
        <span style={{
          color: '#fff',
          fontSize: '22px',
          fontWeight: 600,
          letterSpacing: '-0.5px',
          marginLeft: '-10px',
          fontFamily: "'Segoe UI', 'Inter', 'Oswald', sans-serif",
          lineHeight: 1,
          transform: 'scaleY(1.05)',
        }}>
          Arcanagraph
        </span>
      </Link>

      {/* RIGHT: Navigation Links + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {['Play Now', 'About', 'Contact'].map(label => (
          <Link
            key={label}
            href={label === 'Play Now' ? '/play' : '#'}
            onClick={label === 'Play Now' ? handlePlayNowClick : undefined}
            style={{
              color: 'rgba(228, 226, 226, 0.88)',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 17,
              fontFamily: "'Nunito', system-ui, sans-serif",
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.88)'}
          >
            {label}
          </Link>
        ))}

        {checked && (
          user ? (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.12)',
                color: '#fff',
                borderRadius: 50,
                padding: '12px 32px',
                fontWeight: 800,
                fontSize: 16,
                cursor: loggingOut ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'Nunito', system-ui, sans-serif",
                letterSpacing: '0.5px',
                border: '1.5px solid rgba(255,255,255,0.24)',
                boxShadow: 'none',
                transition: 'transform 0.18s ease-out, background 0.15s',
                opacity: loggingOut ? 0.6 : 1,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1.02) translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
              }}
            >
              {loggingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
            </button>
          ) : (
            <Link
              href="/login"
              style={{
                textDecoration: 'none',
                background: '#f59e0b',
                color: '#fff',
                borderRadius: 50,
                padding: '12px 32px',
                fontWeight: 800,
                fontSize: 16,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'Nunito', system-ui, sans-serif",
                letterSpacing: '0.5px',
                border: 'none',
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
              SIGN IN
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
