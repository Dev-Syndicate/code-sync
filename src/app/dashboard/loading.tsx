export default function DashboardLoading() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        padding: '0',
      }}
    >
      {/* Header skeleton */}
      <div style={{
        borderBottom: '1px solid #1e293b',
        padding: '16px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{
            width: '120px', height: '20px', borderRadius: '6px',
            background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
          }} />
        </div>
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
        }} />
      </div>

      {/* Main content skeleton */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px' }}>
        {/* Greeting skeleton */}
        <div style={{
          width: '280px', height: '28px', borderRadius: '6px',
          background: '#1e293b', marginBottom: '8px',
          animation: 'pulse 2s ease-in-out infinite',
        }} />
        <div style={{
          width: '200px', height: '16px', borderRadius: '6px',
          background: '#1e293b', marginBottom: '32px',
          animation: 'pulse 2s ease-in-out infinite',
        }} />

        {/* Toolbar skeleton */}
        <div style={{
          display: 'flex', gap: '12px', marginBottom: '24px',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          <div style={{
            width: '280px', height: '40px', borderRadius: '8px',
            background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{
            width: '140px', height: '40px', borderRadius: '8px',
            background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
          }} />
          <div style={{ flex: 1 }} />
          <div style={{
            width: '80px', height: '40px', borderRadius: '8px',
            background: '#1e293b', animation: 'pulse 2s ease-in-out infinite',
          }} />
        </div>

        {/* Repo cards skeleton */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '12px',
                padding: '20px',
                animation: 'pulse 2s ease-in-out infinite',
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div style={{ height: '16px', width: '60%', background: '#334155', borderRadius: '4px', marginBottom: '12px' }} />
              <div style={{ height: '12px', width: '90%', background: '#334155', borderRadius: '4px', marginBottom: '8px' }} />
              <div style={{ height: '12px', width: '70%', background: '#334155', borderRadius: '4px', marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ height: '10px', width: '60px', background: '#334155', borderRadius: '4px' }} />
                <div style={{ height: '10px', width: '40px', background: '#334155', borderRadius: '4px' }} />
                <div style={{ height: '10px', width: '80px', background: '#334155', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
