// Capture screen — camera viewfinder + PDF/Gallery import
function CaptureScreen({ onBack, onTab }) {
  const [mode, setMode] = React.useState('Photo'); // Photo | Multi | PDF
  const [flash, setFlash] = React.useState(false);
  const [subject, setSubject] = React.useState('Math');

  return (
    <Phone style={{ background: '#000' }}>
      {/* Top bar overlay */}
      <div style={{
        position: 'absolute', top: 44, left: 0, right: 0, zIndex: 10,
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={onBack} style={glassBtn}>
          <Icon name="x" size={20} color="#fff" />
        </button>
        <div style={{
          padding: '6px 12px', borderRadius: 999,
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff', fontSize: 12, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: T.font,
        }}>
          <Icon name="sparkle" size={12} color={T.gold} /> Auto-OCR activé
        </div>
        <button onClick={() => setFlash(f => !f)} style={glassBtn}>
          <Icon name={flash ? 'flash' : 'flash-off'} size={18} color={flash ? T.gold : '#fff'} />
        </button>
      </div>

      {/* Viewfinder */}
      <div style={{
        position: 'absolute', top: 100, left: 0, right: 0, bottom: 220,
        background: '#0a0a0a', overflow: 'hidden',
      }}>
        {/* simulated paper / classroom shot */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 20%, #2a2a30 0%, #0a0a0a 70%)',
        }} />
        {/* notebook page being captured */}
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%) rotate(-3deg)',
          width: 230, height: 300,
          background: '#fafafa',
          borderRadius: 4,
          boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
          padding: '16px 14px',
          fontFamily: '"Caveat", "Comic Sans MS", cursive',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Mécanique Quantique</div>
          <div style={{ height: 1, background: '#d0d0d0', marginBottom: 8 }} />
          <div style={{ fontSize: 11, color: '#333', lineHeight: 1.5 }}>
            <div>ψ(x,t) = fonction d'onde</div>
            <div style={{ marginLeft: 8, marginTop: 4 }}>|ψ|² = densité de proba</div>
            <div style={{ marginTop: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 10, background: 'rgba(0,0,0,0.04)', padding: '4px 6px', borderRadius: 3 }}>
              iℏ ∂ψ/∂t = Ĥψ
            </div>
            <div style={{ marginTop: 8 }}>→ équation de Schrödinger</div>
            <div style={{ marginTop: 4, marginLeft: 8 }}>· dépend du temps</div>
            <div style={{ marginLeft: 8 }}>· équation centrale</div>
            <div style={{ marginTop: 10, color: T.terracotta }}>⚠ normalisation : ∫|ψ|²=1</div>
          </div>
          {/* paper holes */}
          <div style={{ position: 'absolute', left: 8, top: 26, width: 4, height: 4, borderRadius: 999, background: '#bbb' }} />
          <div style={{ position: 'absolute', left: 8, top: 80, width: 4, height: 4, borderRadius: 999, background: '#bbb' }} />
          <div style={{ position: 'absolute', left: 8, top: 134, width: 4, height: 4, borderRadius: 999, background: '#bbb' }} />
        </div>

        {/* AI document detection frame — corners */}
        <DetectionFrame />

        {/* "Document detected" pill */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          padding: '7px 12px', borderRadius: 999,
          background: 'rgba(31, 138, 91, 0.95)',
          color: '#fff', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: T.font, boxShadow: '0 6px 16px rgba(31,138,91,0.4)',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: '#fff' }} />
          Document détecté · alignement parfait
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        paddingBottom: 24, zIndex: 30,
      }}>
        {/* subject quick-pick */}
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {Object.keys(T.subj).map(s => {
            const active = subject === s;
            const c = T.subj[s];
            return (
              <button key={s} onClick={() => setSubject(s)} style={{
                all: 'unset', cursor: 'pointer', flexShrink: 0,
                padding: '6px 12px', borderRadius: 999,
                background: active ? c.fg : 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: `1px solid ${active ? 'transparent' : 'rgba(255,255,255,0.18)'}`,
                fontSize: 11, fontWeight: 700, fontFamily: T.font,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                backdropFilter: active ? 'none' : 'blur(20px)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: active ? '#fff' : c.fg }} />
                {s}
              </button>
            );
          })}
        </div>

        {/* mode selector */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 24,
          padding: '0 16px 14px',
          fontSize: 12, fontWeight: 700, fontFamily: T.font,
        }}>
          {['Photo', 'Multi', 'PDF'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              all: 'unset', cursor: 'pointer',
              color: mode === m ? T.gold : 'rgba(255,255,255,0.55)',
              padding: '4px 0',
              borderBottom: mode === m ? `2px solid ${T.gold}` : '2px solid transparent',
              letterSpacing: 0.5,
            }}>{m.toUpperCase()}</button>
          ))}
        </div>

        {/* capture row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 30px',
        }}>
          {/* gallery */}
          <button style={{
            all: 'unset', cursor: 'pointer',
            width: 50, height: 50, borderRadius: 14,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2,
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          }}>
            <Icon name="gallery" size={18} color="#fff" />
            <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', opacity: 0.8 }}>GALERIE</span>
          </button>

          {/* shutter */}
          <button style={{
            all: 'unset', cursor: 'pointer',
            width: 76, height: 76, borderRadius: 999,
            background: 'transparent',
            border: '4px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 8px 30px rgba(255,255,255,0.15)',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: 999,
              background: '#fff',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)',
              position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* zellige micro inside shutter */}
              <div style={{
                position: 'absolute', inset: 6, borderRadius: 999,
                backgroundImage: zelligeTile({ fg: T.cobalt, size: 16, opacity: 0.7 }),
                opacity: 0.18,
              }} />
            </div>
          </button>

          {/* PDF import */}
          <button style={{
            all: 'unset', cursor: 'pointer',
            width: 50, height: 50, borderRadius: 14,
            background: T.gold,
            border: '1px solid rgba(255,255,255,0.18)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, color: '#3a2a05',
            boxShadow: '0 6px 14px rgba(212,160,23,0.4)',
          }}>
            <Icon name="upload" size={18} color="#3a2a05" strokeWidth={2.2} />
            <span style={{ fontSize: 8, fontWeight: 800 }}>PDF</span>
          </button>
        </div>

        {/* hint */}
        <div style={{
          marginTop: 12, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.55)',
          fontWeight: 600, fontFamily: T.font, letterSpacing: 0.3,
        }}>
          Maintenir l'appareil stable · texte lisible
        </div>
      </div>

      {/* home indicator white */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.7)', zIndex: 60,
      }} />
    </Phone>
  );
}

function DetectionFrame() {
  // animated corner brackets
  const cornerStyle = (corner) => ({
    position: 'absolute',
    width: 28, height: 28,
    borderColor: '#1F8A5B',
    borderStyle: 'solid',
    borderWidth: 0,
    [corner.includes('t') ? 'top' : 'bottom']: 30,
    [corner.includes('l') ? 'left' : 'right']: 30,
    [`border${corner.includes('t') ? 'Top' : 'Bottom'}Width`]: 3,
    [`border${corner.includes('l') ? 'Left' : 'Right'}Width`]: 3,
    [`border${corner.includes('t') ? 'TopLeft' : corner.includes('l') ? 'BottomLeft' : 'TopRight'}Radius`]: 0,
  });
  return (
    <>
      <div style={{ position: 'absolute', top: 30, left: 30, width: 28, height: 28, borderTop: '3px solid #1F8A5B', borderLeft: '3px solid #1F8A5B', borderTopLeftRadius: 4 }} />
      <div style={{ position: 'absolute', top: 30, right: 30, width: 28, height: 28, borderTop: '3px solid #1F8A5B', borderRight: '3px solid #1F8A5B', borderTopRightRadius: 4 }} />
      <div style={{ position: 'absolute', bottom: 30, left: 30, width: 28, height: 28, borderBottom: '3px solid #1F8A5B', borderLeft: '3px solid #1F8A5B', borderBottomLeftRadius: 4 }} />
      <div style={{ position: 'absolute', bottom: 30, right: 30, width: 28, height: 28, borderBottom: '3px solid #1F8A5B', borderRight: '3px solid #1F8A5B', borderBottomRightRadius: 4 }} />
    </>
  );
}

const glassBtn = {
  all: 'unset', cursor: 'pointer',
  width: 38, height: 38, borderRadius: 999,
  background: 'rgba(255,255,255,0.12)',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.2)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

Object.assign(window, { CaptureScreen });
