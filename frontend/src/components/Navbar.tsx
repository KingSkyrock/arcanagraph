'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'firebase/auth';
import { apiUrl } from '@/lib/api';
import { firebaseConfigReady, getFirebaseAuth } from '@/lib/firebase-client';

type SessionUser = { id: string; displayName?: string; email?: string } | null;
type NavLink = { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: 'Play Now', href: '/play' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '#' },
];

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
      {/* LEFT: Logo & Brand Name (Microsoft-style layout) */}
      <Link
        href="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          textDecoration: 'none',
          cursor: 'pointer',
          padding: '4px 8px', // smaller padding
          borderRadius: '4px',
          transition: 'transform 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.07)';
          e.currentTarget.style.background = 'transparent';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.background = 'transparent';
          // revert text color to gray if not clicked
          const span = e.currentTarget.querySelector('span');
          if (span) span.style.color = 'rgb(220, 229, 238)';
        }}
        onMouseDown={e => {
          // On click, make Arcanagraph text white
          const span = e.currentTarget.querySelector('span');
          if (span) span.style.color = 'rgb(255, 255, 255)';
        }}
        onMouseUp={e => {
          // On release, revert Arcanagraph text to gray
          const span = e.currentTarget.querySelector('span');
          if (span) span.style.color = 'rgb(220, 229, 238)';
        }}
      >
        <Image
          src="/images/logo.png"
          alt="Arcanagraph Home"
          width={55} // smaller logo
          height={48}
          style={{ objectFit: 'contain', transition: 'transform 0.15s' }}
        />
        <span style={{
          color: 'rgb(220, 229, 238)', // light gray
          fontSize: '18px', // smaller font
          fontWeight: 600,
          letterSpacing: '-0.5px',
          marginLeft: '-2px',
          fontFamily: "'Segoe UI', 'Inter', 'Oswald', sans-serif",
          lineHeight: 1,
          transform: 'scaleY(1.05)',
          transition: 'color 0.15s, transform 0.15s',
        }}>
          Arcanagraph
        </span>
      </Link>

      {/* RIGHT: Navigation Links + CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {NAV_LINKS.map(({ label, href }) => (
          <Link
            key={label}
            href={href}
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
                padding: '10px 28px',
                fontWeight: 700,
                fontSize: 15,
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
                background: 'rgb(245, 158, 11)',
                color: 'rgb(255,255,255)',
                borderRadius: 50,
                padding: '10px 28px',
                fontWeight: 700,
                fontSize: 15,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'Nunito', system-ui, sans-serif",
                letterSpacing: '0.5px',
                border: 'none',
                boxShadow: '0 3px 0px rgb(180, 83, 9), 0 3px 8px rgba(0,0,0,0.18)',
                transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 5px 0px rgb(180, 83, 9), 0 7px 12px rgba(0,0,0,0.18)';
                e.currentTarget.style.background = 'rgb(217, 119, 6)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1) translateY(0)';
                e.currentTarget.style.boxShadow = '0 3px 0px rgb(180, 83, 9), 0 3px 8px rgba(0,0,0,0.18)';
                e.currentTarget.style.background = 'rgb(245, 158, 11)';
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
