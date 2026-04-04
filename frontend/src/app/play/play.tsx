'use client';
import Navbar from '@/components/Navbar'; // Use the shared component

export default function PlayPage() {
  return (
    <main style={{ 
      minHeight: '100vh', 
      backgroundColor: '#0f172a', // Dark "Space/Magic" theme
      color: '#fff' 
    }}>
      {/* 1. Shared Navigation */}
      <Navbar />

      {/* 2. Game Layout Container */}
      <div style={{ 
        paddingTop: '100px', // Space for fixed Navbar
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        
        {/* 3. The "Canvas" or Math Problem Area */}
        <div style={{
          width: '90%',
          maxWidth: '1000px',
          height: '600px',
          background: 'rgba(30, 41, 59, 0.7)',
          borderRadius: '24px',
          border: '2px solid #3b82f6',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative'
        }}>
          <h2 style={{ fontFamily: 'Impact' }}>Math Magic Battle Begins...</h2>
          {/* This is where your game logic/canvas will eventually go! */}
        </div>

        {/* 4. Controls / Inventory */}
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Spell Slots could go here */}
        </div>
      </div>
    </main>
  );
}