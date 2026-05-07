// Bottom nav with FAB camera button — notched cradle style
function BottomNav({ active = 'home', onChange, onCapture }) {
  const items = [
    { id: 'home',    label: 'Accueil', icon: 'home' },
    { id: 'notes',   label: 'Notes',   icon: 'notes' },
    { id: 'capture', label: '',        icon: 'camera', fab: true },
    { id: 'study',   label: 'Étudier', icon: 'study' },
    { id: 'profile', label: 'Profil',  icon: 'profile' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingBottom: 24, // home indicator clearance
      pointerEvents: 'none', zIndex: 30,
    }}>
      {/* nav bar */}
      <div style={{
        position: 'relative', margin: '0 12px', height: 64,
        background: '#FFFFFF',
        borderRadius: 22,
        boxShadow: '0 -2px 8px rgba(20,30,60,0.04), 0 8px 24px rgba(20,30,60,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        pointerEvents: 'auto',
        border: `1px solid ${T.borderSoft}`,
      }}>
        {items.map(it => {
          if (it.fab) {
            return (
              <div key={it.id} style={{ width: 64, height: 64, position: 'relative' }}>
                {/* FAB cradle */}
                <button onClick={onCapture} style={{
                  position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
                  width: 60, height: 60, borderRadius: 999,
                  background: `linear-gradient(160deg, ${T.cobalt}, ${T.cobaltDeep})`,
                  border: '4px solid #FFFFFF',
                  boxShadow: '0 10px 24px rgba(27,79,216,0.42), 0 2px 4px rgba(27,79,216,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', padding: 0,
                }}>
                  {/* zellige micro-pattern inside FAB */}
                  <div style={{
                    position: 'absolute', inset: 4, borderRadius: 999,
                    backgroundImage: zelligeTile({ fg: '#ffffff', size: 18, opacity: 0.18 }),
                    opacity: 0.7, pointerEvents: 'none',
                  }} />
                  <Icon name="camera" size={26} color="#fff" strokeWidth={2} />
                </button>
              </div>
            );
          }
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onChange?.(it.id)} style={{
              flex: 1, height: '100%', border: 0, background: 'transparent', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: 0,
            }}>
              <Icon name={it.icon} size={22}
                color={isActive ? T.cobalt : T.textFaint}
                strokeWidth={isActive ? 2.1 : 1.7}
              />
              <span style={{
                fontFamily: T.font, fontSize: 10.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.cobalt : T.textFaint, letterSpacing: 0.1,
              }}>{it.label}</span>
              {isActive && (
                <div style={{
                  position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 999,
                  background: T.cobalt,
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Top status bar — light, minimal (no Dynamic Island per academic feel; iOS frame supplies the island)
function StatusBarLight({ time = '9:41' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 28px 6px', height: 44, position: 'relative', zIndex: 5,
      fontFamily: T.font,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{time}</span>
      <div style={{ width: 126 }} /> {/* island spacer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="18" height="11" viewBox="0 0 18 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill={T.text}/>
          <rect x="4.5" y="5" width="3" height="6" rx="0.6" fill={T.text}/>
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill={T.text}/>
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill={T.text}/>
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11">
          <path d="M8 3C9.8 3 11.4 3.7 12.6 4.8L13.5 4C12 2.4 10.1 1.5 8 1.5S4 2.4 2.5 4l0.9 0.8C4.6 3.7 6.2 3 8 3z" fill={T.text}/>
          <path d="M8 6c1 0 2 0.4 2.7 1.1l1-1c-1-1-2.3-1.6-3.7-1.6S5.3 5 4.3 6l1 1C6 6.4 7 6 8 6z" fill={T.text}/>
          <circle cx="8" cy="9.5" r="1.2" fill={T.text}/>
        </svg>
        <svg width="25" height="12" viewBox="0 0 25 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke={T.text} strokeOpacity="0.4" fill="none"/>
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill={T.text}/>
          <path d="M23.5 4v4c0.7-0.2 1.2-0.9 1.2-2s-0.5-1.8-1.2-2z" fill={T.text} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

// Phone shell — used to wrap each screen inside the design canvas
function Phone({ children, style = {}, width = 390, height = 800 }) {
  return (
    <div style={{
      width, height, background: T.bg,
      borderRadius: 44, overflow: 'hidden', position: 'relative',
      boxShadow: '0 30px 60px rgba(20,30,60,0.14), 0 0 0 1px rgba(20,30,60,0.06)',
      fontFamily: T.font, color: T.text,
      WebkitFontSmoothing: 'antialiased',
      ...style,
    }}>
      {/* dynamic island */}
      <div style={{
        position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
        width: 120, height: 34, borderRadius: 22, background: '#000', zIndex: 50,
      }} />
      <StatusBarLight />
      {children}
      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.25)', zIndex: 60,
      }} />
    </div>
  );
}

// Scroll body — content area between status bar and bottom nav
function ScrollBody({ children, padBottom = 110, style = {} }) {
  return (
    <div style={{
      position: 'absolute', top: 44, left: 0, right: 0, bottom: 0,
      overflowY: 'auto', overflowX: 'hidden',
      paddingBottom: padBottom,
      ...style,
    }}>
      {children}
    </div>
  );
}

Object.assign(window, { BottomNav, StatusBarLight, Phone, ScrollBody });
