'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
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
      background: '#0f1f4b', // Deep navy background
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>
      {/* LEFT: Logo & Brand Name (Microsoft-style layout) */}
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
          marginLeft: '-10px', // Nudges text closer to the cropped elephant
          fontFamily: "'Segoe UI', 'Inter', 'Oswald', sans-serif",
          lineHeight: 1,
          transform: 'scaleY(1.05)', // Adds professional height
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

        <button style={{
          background: '#f59e0b', 
          color: '#fff', 
          border: 'none',
          borderRadius: 50, 
          padding: '11px 32px',
          fontWeight: 800, 
          fontSize: 15, 
          cursor: 'pointer',
          fontFamily: "'Nunito', system-ui, sans-serif",
          letterSpacing: '0.4px',
          boxShadow: '0 6px 20px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.3)',
          transition: 'background 0.15s, transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#d97706';
            e.currentTarget.style.transform = 'scale(1.05) translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 10px 28px rgba(245,158,11,0.65), 0 4px 12px rgba(0,0,0,0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#f59e0b';
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(245,158,11,0.55), 0 2px 8px rgba(0,0,0,0.3)';
          }}
        >
          SIGN IN
        </button>
      </div>
    </nav>
  );
}