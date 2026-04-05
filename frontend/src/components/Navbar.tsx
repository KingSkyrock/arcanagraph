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
        
        <button
          style={{
            textDecoration: 'none',
            background: '#f59e0b', // Amber background
            color: '#fff',
            borderRadius: 50,
            padding: '12px 32px', // Slightly smaller padding for a Navbar
            fontWeight: 800,
            fontSize: 16,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: "'Nunito', system-ui, sans-serif",
            letterSpacing: '0.5px',
            border: 'none',
            // The "Lego" Hard Shadow
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
        </button>
      </div>
    </nav>
  );
}