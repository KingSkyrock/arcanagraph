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
        {['Play Now', 'About', 'Contact'].map(label => (
          <Link 
            key={label} 
            href={
              label === 'Play Now' ? '/play' :
              label === 'About' ? '/about' :
              label === 'Contact' ? '/contact' : '#'
            }
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
            background: 'rgb(245, 158, 11)', // Amber background
            color: 'rgb(255,255,255)',
            borderRadius: 50,
            padding: '10px 28px', // Smaller padding
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
        </button>
      </div>
    </nav>
  );
}