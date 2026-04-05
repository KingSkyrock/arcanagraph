'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '@/components/Skeleton';
import { signOut } from 'firebase/auth';
import { apiUrl } from '@/lib/api';
import { firebaseConfigReady, getFirebaseAuth } from '@/lib/firebase-client';
import {
  getDefaultProfilePicture,
  getProfilePictureById,
  loadProfilePictureCatalog,
  type ProfilePictureCatalogEntry,
} from '@/lib/profile-pictures';
import {
  emitSessionUserUpdated,
  subscribeToSessionUserUpdates,
} from '@/lib/session-user-events';
import type { AppUser } from '@/lib/types';

type SessionUser = Pick<AppUser, 'id' | 'displayName' | 'email' | 'profilePictureId'> | null;
type NavLink = { label: string; href: string };

const NAV_LINKS: NavLink[] = [
  { label: 'Play Now', href: '/play' },
  { label: 'About', href: '/about' },
  { label: 'Settings', href: '/settings' },
];

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>(null);
  const [checked, setChecked] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePictures, setProfilePictures] = useState<ProfilePictureCatalogEntry[]>([]);

  useEffect(() => {
    loadProfilePictureCatalog()
      .then(setProfilePictures)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(apiUrl('/api/auth/me'), { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.user) setUser(data.user); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  useEffect(() => {
    return subscribeToSessionUserUpdates(updatedUser => {
      setUser(updatedUser);
      setChecked(true);
    });
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setMenuOpen(false);
  }, []);

  const selectedProfilePicture =
    getProfilePictureById(profilePictures, user?.profilePictureId) ??
    getDefaultProfilePicture(profilePictures);
  const playerLabel = user?.displayName || user?.email || 'Player';

  async function handleLogout() {
    if (!window.confirm('Sign out of Arcanagraph?')) return;
    setLoggingOut(true);
    try {
      await fetch(apiUrl('/api/auth/logout'), { method: 'POST', credentials: 'include' });
      if (firebaseConfigReady()) {
        await signOut(getFirebaseAuth());
      }
      setUser(null);
      emitSessionUserUpdated(null);
      setMenuOpen(false);
      router.push('/');
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <style>{`
        .nav-links { display: flex; align-items: center; gap: 40; }
        .nav-hamburger { display: none; }
        .nav-drawer { display: none; }
        .nav-drawer-backdrop { display: none; }
        @media (max-width: 720px) {
          .nav-links { display: none !important; }
          .nav-hamburger { display: flex !important; }
          .nav-drawer[data-open="true"] { display: flex !important; }
          .nav-drawer-backdrop[data-open="true"] { display: block !important; }
        }
      `}</style>

      <nav style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 78,
        background: '#0f1f4b',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Logo */}
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', textDecoration: 'none',
          padding: '4px 8px', borderRadius: 4, transition: 'transform 0.15s',
        }}>
          <Image
            src="/images/logo.png" alt="Arcanagraph Home"
            width={55} height={48}
            style={{ objectFit: 'contain' }}
          />
          <span style={{
            color: 'rgb(220, 229, 238)', fontSize: 18, fontWeight: 700,
            letterSpacing: '-0.3px', marginLeft: 6,
          }}>
            Arcanagraph
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {NAV_LINKS.map(({ label, href }) => (
            <Link key={label} href={href} style={{
              color: 'rgba(228, 226, 226, 0.88)', textDecoration: 'none',
              fontWeight: 600, fontSize: 17, transition: 'color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.88)'}
            >
              {label}
            </Link>
          ))}

          {!checked ? (
            <Skeleton width={100} height={40} borderRadius={50} />
          ) : user ? (
              <>
                {/* Profile pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '4px 10px 4px 4px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}>
                  <div style={{
                    position: 'relative', width: 36, height: 36,
                    overflow: 'hidden', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0,
                  }}>
                    {selectedProfilePicture ? (
                      <Image
                        src={selectedProfilePicture.imagePath}
                        alt={`${playerLabel} avatar`}
                        fill sizes="36px" unoptimized
                        style={{ objectFit: 'cover', imageRendering: 'pixelated' }}
                      />
                    ) : null}
                  </div>
                  <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
                    <strong style={{
                      maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', color: '#fff', fontSize: 14, lineHeight: 1.1,
                    }}>
                      {playerLabel}
                    </strong>
                  </div>
                </div>

                <button onClick={handleLogout} disabled={loggingOut} style={{
                  background: 'rgba(255,255,255,0.12)', color: '#fff', borderRadius: 50,
                  padding: '10px 28px', fontWeight: 700, fontSize: 15,
                  cursor: loggingOut ? 'wait' : 'pointer',
                  border: '1.5px solid rgba(255,255,255,0.24)', boxShadow: 'none',
                  transition: 'transform 0.18s ease-out, background 0.15s',
                  opacity: loggingOut ? 0.6 : 1,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
                >
                  {loggingOut ? 'SIGNING OUT...' : 'SIGN OUT'}
                </button>
              </>
            ) : (
              <Link href="/login" style={{
                textDecoration: 'none', background: 'rgb(245, 158, 11)', color: '#fff',
                borderRadius: 50, padding: '10px 28px', fontWeight: 700, fontSize: 15,
                border: 'none',
                boxShadow: '0 3px 0px rgb(180, 83, 9), 0 3px 8px rgba(0,0,0,0.18)',
                transition: 'transform 0.18s ease-out, box-shadow 0.18s, background 0.15s',
              }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)';
                  e.currentTarget.style.background = 'rgb(217, 119, 6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1) translateY(0)';
                  e.currentTarget.style.background = 'rgb(245, 158, 11)';
                }}
              >
                SIGN IN
              </Link>
            )
          }
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          style={{
            display: 'none', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, flexDirection: 'column', gap: 5,
          }}
        >
          <span style={{ width: 24, height: 2.5, background: '#fff', borderRadius: 2, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(45deg) translateY(7.5px)' : 'none' }} />
          <span style={{ width: 24, height: 2.5, background: '#fff', borderRadius: 2, transition: 'opacity 0.2s', opacity: menuOpen ? 0 : 1 }} />
          <span style={{ width: 24, height: 2.5, background: '#fff', borderRadius: 2, transition: 'transform 0.2s', transform: menuOpen ? 'rotate(-45deg) translateY(-7.5px)' : 'none' }} />
        </button>
      </nav>

      {/* Mobile backdrop */}
      <div
        className="nav-drawer-backdrop"
        data-open={menuOpen}
        onClick={() => setMenuOpen(false)}
        style={{
          display: 'none', position: 'fixed', inset: 0,
          zIndex: 99, background: 'rgba(0,0,0,0.5)',
        }}
      />

      {/* Mobile drawer */}
      <div
        className="nav-drawer"
        data-open={menuOpen}
        style={{
          display: 'none', position: 'fixed', top: 78, right: 0, bottom: 0,
          width: 280, zIndex: 100,
          background: '#0f1f4b', borderLeft: '1px solid rgba(255,255,255,0.1)',
          flexDirection: 'column', padding: '24px 20px', gap: 16,
          overflowY: 'auto',
        }}
      >
        {NAV_LINKS.map(({ label, href }) => (
          <Link key={label} href={href} onClick={() => setMenuOpen(false)} style={{
            color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 18,
            padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            {label}
          </Link>
        ))}

        <div style={{ marginTop: 12 }}>
          {!checked ? (
            <Skeleton width="100%" height={48} borderRadius={14} />
          ) : user ? (
              <button onClick={handleLogout} disabled={loggingOut} style={{
                width: '100%', background: 'rgba(255,255,255,0.12)', color: '#fff',
                borderRadius: 14, padding: '14px 20px', fontWeight: 700, fontSize: 16,
                cursor: loggingOut ? 'wait' : 'pointer',
                border: '1.5px solid rgba(255,255,255,0.24)',
                opacity: loggingOut ? 0.6 : 1,
              }}>
                {loggingOut ? 'Signing out...' : 'Sign Out'}
              </button>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)} style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                background: '#f59e0b', color: '#fff', borderRadius: 14,
                padding: '14px 20px', fontWeight: 700, fontSize: 16,
                boxShadow: '0 3px 0 #b45309',
              }}>
                Sign In
              </Link>
            )
          }
        </div>
      </div>
    </>
  );
}
