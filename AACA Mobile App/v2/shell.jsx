// v2 shell — Phone with warm sand bg, big-type nav with zellige strip

function StatusBar2({ time = '9:41', dark = false }) {
  const c = dark ? '#fff' : T2.text;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 28px 6px', height: 44, position: 'relative', zIndex: 5,
      fontFamily: T2.font,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: c }}>{time}</span>
      <div style={{ width: 126 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="18" height="11" viewBox="0 0 18 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={c}/>
          <rect x="4.5" y="5" width="3" height="6" rx="0.6" fill={c}/>
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill={c}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={c}/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke={c} strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill={c}/>
        </svg>
      </div>
    </div>
  );
}

function Phone2({ children, style = {}, width = 390, height = 800, statusDark = false }) {
  return (
    <div style={{
      width, height, background: T2.bg,
      borderRadius: 44, overflow: 'hidden', position: 'relative',
      boxShadow: '0 30px 60px rgba(80,50,20,0.18), 0 0 0 1px rgba(80,50,20,0.08)',
      fontFamily: T2.font, color: T2.text,
      WebkitFontSmoothing: 'antialiased',
      ...style,
    }}>
      <div style={{
        position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 34, borderRadius: 22, background: '#000', zIndex: 50,
      }} />
      <StatusBar2 dark={statusDark} />
      {children}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999,
        background: statusDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.25)', zIndex: 60,
      }} />
    </div>
  );
}

function ScrollBody2({ children, padBottom = 110, top = 44, style = {} }) {
  return (
    <div style={{
      position: 'absolute', top, left: 0, right: 0, bottom: 0,
      overflowY: 'auto', overflowX: 'hidden',
      paddingBottom: padBottom,
      ...style,
    }}>
      {children}
    </div>
  );
}

// Bottom nav v2 — bigger, zellige strip on top, FAB centered
function BottomNav2({ active = 'home', onChange, onCapture }) {
  const items = [
    { id: 'home',    label: 'Accueil', icon: 'home' },
    { id: 'notes',   label: 'Notes',   icon: 'notes' },
    { id: 'capture', fab: true },
    { id: 'study',   label: 'Étudier', icon: 'study' },
    { id: 'profile', label: 'Profil',  icon: 'profile' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 24, pointerEvents: 'none', zIndex: 30,
    }}>
      <div style={{
        margin: '0 12px', position: 'relative',
        background: T2.surface, borderRadius: 22,
        boxShadow: '0 -2px 8px rgba(120,80,30,0.05), 0 12px 28px rgba(120,80,30,0.14)',
        border: `1px solid ${T2.border}`,
        pointerEvents: 'auto', overflow: 'hidden',
      }}>
        {/* zellige strip on top of nav */}
        <ZelligeBorder height={10} color={T2.blue} accent={T2.saffron} bg={T2.bgWarm} />
        <div style={{
          height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        }}>
          {items.map(it => {
            if (it.fab) {
              return (
                <div key={it.id} style={{ width: 64, height: 64, position: 'relative' }}>
                  <button onClick={onCapture} style={{
                    position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)',
                    width: 64, height: 64, borderRadius: 999,
                    background: `linear-gradient(160deg, ${T2.blue}, ${T2.blueDeep})`,
                    border: '4px solid #FFFFFF',
                    boxShadow: `0 12px 28px ${T2.blue}66, 0 2px 4px ${T2.blue}33`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0,
                  }}>
                    <div style={{
                      position: 'absolute', inset: 4, borderRadius: 999,
                      backgroundImage: zelligeStar({ fg: '#fff', bg: 'transparent', size: 22, accent: T2.saffron, stroke: 0 }),
                      opacity: 0.22, pointerEvents: 'none',
                    }} />
                    <Icon name="camera" size={28} color="#fff" strokeWidth={2.2} />
                  </button>
                </div>
              );
            }
            const isActive = active === it.id;
            return (
              <button key={it.id} onClick={() => onChange?.(it.id)} style={{
                flex: 1, height: '100%', border: 0, background: 'transparent', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, padding: 0, position: 'relative',
              }}>
                <Icon name={it.icon} size={24}
                  color={isActive ? T2.blue : T2.textFaint}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
                <span style={{
                  fontFamily: T2.font, fontSize: 11, fontWeight: isActive ? 800 : 600,
                  color: isActive ? T2.blue : T2.textFaint, letterSpacing: 0.1,
                }}>{it.label}</span>
                {isActive && (
                  <div style={{
                    position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 999,
                    background: T2.saffron,
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Phone2, ScrollBody2, BottomNav2, StatusBar2 });
