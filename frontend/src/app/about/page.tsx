import Navbar from '@/components/Navbar';

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', padding: '64px 0', background: '#f8fafc' }}>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: 32 }}>
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            marginBottom: 24,
            color: '#1a56db',
            fontFamily: "'Arial Black', 'Oswald', system-ui, sans-serif"
          }}>
            About Arcanagraph
          </h1>
          <p style={{
            fontSize: 20,
            lineHeight: 1.6,
            color: '#334155',
            fontFamily: "'Nunito', system-ui, sans-serif"
          }}>
            poopy poop!!!!!!!<br />
            {/* Add more about your mission, team, etc. */}
          </p>
        </div>
      </main>
      <footer
        style={{
          width: '100%',
          background: 'rgba(30, 41, 59, 0.98)',
          color: '#e0e7ef',
          fontFamily: "'Nunito', system-ui, sans-serif",
          fontWeight: 500,
          fontSize: 18,
          padding: '48px 0 40px 0',
          marginTop: 64,
          boxShadow: '0 -2px 16px rgba(30,41,59,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minHeight: 220,
          zIndex: 20,
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: 1200, width: '90%', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: '0.5px',
              color: '#fff',
              marginBottom: 8,
              fontFamily: "'Segoe UI', 'Inter', 'Oswald', sans-serif",
            }}
          >
            Arcanagraph
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 15, color: '#b6c3d6', textAlign: 'center', marginBottom: 4 }}>
          Made with <span style={{ color: '#ef4444', fontSize: 18, verticalAlign: 'middle' }}>♥</span> by ...
        </div>
        <div style={{ fontSize: 15, color: '#b6c3d6', textAlign: 'center' }}>
          © 2026 Arcanagraph. All rights reserved.
        </div>
      </footer>
    </>
  );
}