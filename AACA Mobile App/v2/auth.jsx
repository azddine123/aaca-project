// v2 Splash — full zellige mosaic background, royal blue + saffron + terracotta + green
function SplashScreen2() {
  return (
    <Phone2 statusDark style={{ background: T2.blueDeep }}>
      {/* Full polychrome zellige background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: zelligeRich({ size: 140 }),
        backgroundSize: '140px 140px', backgroundRepeat: 'repeat',
      }} />
      {/* radial darken to focus center */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(circle at 50% 42%, transparent 0%, ${T2.blueDeep}cc 70%, ${T2.blueDeep} 100%)`,
      }} />

      {/* Top arabic */}
      <div style={{
        position: 'absolute', top: 80, left: 0, right: 0, textAlign: 'center',
        zIndex: 5,
      }}>
        <div style={{
          fontSize: 22, fontWeight: 700, color: T2.saffron,
          fontFamily: T2.fontArabic, direction: 'rtl', letterSpacing: 1,
        }}>
          المساعد المعرفي الأكاديمي
        </div>
      </div>

      {/* Center: bold acronym medallion */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 5, color: '#fff', fontFamily: T2.font, padding: '0 32px',
      }}>
        {/* Star-shaped medallion */}
        <div style={{
          position: 'relative', width: 180, height: 180,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: 'absolute' }}>
            <defs>
              <radialGradient id="medCenter">
                <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
              </radialGradient>
            </defs>
            {/* outer 8-point star */}
            <g transform="translate(90 90)">
              {(()=>{
                const R = 84, r = 36;
                let p = '';
                for (let i = 0; i < 16; i++) {
                  const ang = (i * Math.PI) / 8 - Math.PI / 2;
                  const rad = i % 2 === 0 ? R : r;
                  const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
                  p += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
                }
                return <path d={p + 'Z'} fill="url(#medCenter)" stroke={T2.saffron} strokeWidth="2" />;
              })()}
              {/* inner ring */}
              <circle r="48" fill="none" stroke={T2.saffron} strokeWidth="0.8" opacity="0.5" />
              <circle r="58" fill="none" stroke={T2.saffron} strokeWidth="0.5" opacity="0.3" />
            </g>
          </svg>
          {/* AACA letters */}
          <div style={{
            position: 'relative', zIndex: 1,
            fontSize: 48, fontWeight: 800, letterSpacing: 4,
            color: '#fff',
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>AACA</div>
        </div>

        {/* gold ornament */}
        <svg width="60" height="14" viewBox="0 0 60 14" style={{ marginTop: 28 }}>
          <g fill={T2.saffron}>
            <path d="M30 1 L34 7 L30 13 L26 7 Z"/>
            <circle cx="14" cy="7" r="1.6"/>
            <circle cx="46" cy="7" r="1.6"/>
            <circle cx="6" cy="7" r="1"/>
            <circle cx="54" cy="7" r="1"/>
          </g>
        </svg>

        {/* Tagline */}
        <div style={{
          marginTop: 18, fontSize: 14, fontWeight: 600,
          color: '#fff', opacity: 0.92,
          textAlign: 'center', letterSpacing: 0.4, lineHeight: 1.5,
        }}>
          Assistant cognitif académique<br/>
          <span style={{ opacity: 0.7, fontSize: 12, fontWeight: 500 }}>par et pour les étudiants marocains</span>
        </div>
      </div>

      {/* Bottom — loader */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 70, zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <div style={{ width: 120, height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
          <div style={{ width: '60%', height: '100%', background: T2.saffron }} />
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)',
          letterSpacing: 1.5, textTransform: 'uppercase',
        }}>Chargement</div>
      </div>

      {/* Bottom zellige border strip */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 4, opacity: 0.7 }}>
        <ZelligeBorder height={14} color={T2.saffron} accent="#fff" bg="transparent" />
      </div>
    </Phone2>
  );
}

// v2 Login
function LoginScreen2() {
  return (
    <Phone2 statusDark>
      {/* Big arch header — 35% of screen */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 280,
        background: T2.blueDeep, overflow: 'hidden',
      }}>
        {/* polychrome zellige fill */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: zelligeRich({ size: 110 }),
          backgroundSize: '110px 110px',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, transparent 0%, ${T2.blueDeep}55 60%, ${T2.bg} 100%)`,
        }} />
        {/* arch silhouette stamped over zellige (negative cut) */}
        <svg viewBox="0 0 390 280" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <mask id="archMask">
              <rect width="390" height="280" fill="#fff"/>
              <path d="M 195 70
                       C 138 70 100 105 100 165
                       L 100 280
                       L 290 280
                       L 290 165
                       C 290 105 252 70 195 70 Z"
                    fill="#000"/>
            </mask>
          </defs>
          {/* warm sand fill behind, masked through arch — creates the 'window' */}
          <rect width="390" height="280" fill={T2.bg} mask="url(#archMask)" opacity="0" />
          {/* gold trim along arch */}
          <path d="M 100 280 L 100 165 C 100 105 138 70 195 70 C 252 70 290 105 290 165 L 290 280"
                fill="none" stroke={T2.saffron} strokeWidth="3" />
          <path d="M 110 280 L 110 168 C 110 112 145 78 195 78 C 245 78 280 112 280 168 L 280 280"
                fill="none" stroke={T2.saffron} strokeWidth="0.8" opacity="0.6" />
          {/* keystone */}
          <g transform="translate(195 70)">
            <path d="M0 -10 L10 0 L0 10 L-10 0 Z" fill={T2.saffron}/>
            <circle r="3" fill={T2.blueDeep}/>
          </g>
        </svg>

        {/* Title overlay */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 90, textAlign: 'center', color: '#fff',
        }}>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>AACA</div>
          <div style={{
            marginTop: 8, fontSize: 14, fontFamily: T2.fontArabic, color: T2.saffron,
            direction: 'rtl', fontWeight: 700,
          }}>
            مرحباً بعودتك
          </div>
        </div>
      </div>

      <ScrollBody2 top={0} padBottom={20}>
        <div style={{ height: 220 }} />

        <div style={{ padding: '0 24px' }}>
          <h1 style={{
            margin: 0, fontSize: 34, fontWeight: 800, letterSpacing: -0.8, color: T2.text,
          }}>
            Bon retour
          </h1>
          <div style={{ marginTop: 6, fontSize: 15, color: T2.textMuted, fontWeight: 500 }}>
            Connectez-vous pour reprendre
          </div>

          {/* form */}
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field2 label="Email" placeholder="exemple@um6p.ma" icon="globe" defaultValue="yasmine.elamrani@um6p.ma" />
            <Field2 label="Mot de passe" placeholder="••••••••" icon="bookmark" defaultValue="••••••••••" trailing={
              <span style={{ fontSize: 12, fontWeight: 700, color: T2.blue, fontFamily: T2.font }}>Afficher</span>
            } />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <a style={{ fontSize: 13, fontWeight: 700, color: T2.blue, textDecoration: 'none' }}>Mot de passe oublié&nbsp;?</a>
          </div>

          {/* PRIMARY — single big action */}
          <button style={primary2}>
            Se connecter
            <Icon name="arrow-right" size={18} color="#fff" />
          </button>

          <div style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: T2.textMuted, fontFamily: T2.font }}>
            Pas encore de compte ?{' '}
            <a style={{ color: T2.terracotta, fontWeight: 800, textDecoration: 'none' }}>Créer un compte</a>
          </div>
        </div>
      </ScrollBody2>
    </Phone2>
  );
}

// v2 Register
function RegisterScreen2() {
  const [picked, setPicked] = React.useState(['Math', 'Physics']);
  const toggle = (s) => setPicked(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const subjects = ['Math', 'Physics', 'Biology', 'CS', 'Chimie', 'Histoire'];
  return (
    <Phone2 statusDark>
      {/* Arch header — 35% */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 280,
        background: T2.blueDeep, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: zelligeRich({ size: 110 }),
          backgroundSize: '110px 110px',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(180deg, transparent 0%, ${T2.blueDeep}55 60%, ${T2.bg} 100%)`,
        }} />
        <svg viewBox="0 0 390 280" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path d="M 100 280 L 100 165 C 100 105 138 70 195 70 C 252 70 290 105 290 165 L 290 280"
                fill="none" stroke={T2.saffron} strokeWidth="3" />
          <path d="M 110 280 L 110 168 C 110 112 145 78 195 78 C 245 78 280 112 280 168 L 280 280"
                fill="none" stroke={T2.saffron} strokeWidth="0.8" opacity="0.6" />
          <g transform="translate(195 70)">
            <path d="M0 -10 L10 0 L0 10 L-10 0 Z" fill={T2.saffron}/>
            <circle r="3" fill={T2.blueDeep}/>
          </g>
        </svg>

        <button style={{
          position: 'absolute', top: 60, left: 18,
          all: 'unset', cursor: 'pointer',
          width: 40, height: 40, borderRadius: 999,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.25)',
          backdropFilter: 'blur(20px)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chevron-left" size={20} color="#fff" />
        </button>

        <div style={{
          position: 'absolute', left: 0, right: 0, top: 100, textAlign: 'center',
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: -0.4 }}>Créer un compte</div>
          <div style={{
            marginTop: 6, fontSize: 13, fontFamily: T2.fontArabic, color: T2.saffron,
            direction: 'rtl', fontWeight: 700,
          }}>
            انضم إلى المجتمع
          </div>
        </div>
      </div>

      <ScrollBody2 top={0} padBottom={28}>
        <div style={{ height: 250 }} />

        <div style={{ padding: '0 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field2 label="Nom complet" placeholder="Yasmine El Amrani" icon="profile" defaultValue="Yasmine El Amrani" />
            <Field2 label="Email" placeholder="exemple@um6p.ma" icon="globe" defaultValue="yasmine.elamrani@um6p.ma" />
            <Field2 label="Mot de passe" placeholder="Au moins 8 caractères" icon="bookmark" defaultValue="••••••••" />
            <Field2 label="Établissement" placeholder="Université, lycée, école…" icon="study" defaultValue="UM6P · Benguérir" trailing={<Icon name="chevron" size={14} color={T2.textFaint} />} />
          </div>

          {/* matières — minimal, 2 cols, big tappable */}
          <div style={{ marginTop: 32 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T2.text, letterSpacing: -0.5 }}>Matières</h2>
              <span style={{
                fontSize: 12, fontWeight: 700, color: T2.terracotta,
                fontFamily: T2.fontArabic, direction: 'rtl',
              }}>المواد</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {subjects.map(s => {
                const active = picked.includes(s);
                const c = T2.subj[s];
                return (
                  <button key={s} onClick={() => toggle(s)} style={{
                    all: 'unset', cursor: 'pointer',
                    padding: '14px 14px', borderRadius: 16,
                    background: active ? c.soft : T2.surface,
                    border: `2px solid ${active ? c.fg : T2.border}`,
                    display: 'flex', alignItems: 'center', gap: 10, fontFamily: T2.font,
                    boxShadow: active ? `0 6px 14px ${c.fg}25` : T2.card,
                    transition: 'all 0.18s',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9,
                      background: active ? c.fg : c.soft,
                      color: active ? '#fff' : c.fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 800, flexShrink: 0,
                    }}>{({Math:'∫',Physics:'φ',Biology:'⌬',CS:'{',Chimie:'⚗',Histoire:'§'})[s]}</div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: T2.text }}>{c.name}</div>
                    {active && <Icon name="check" size={16} color={c.fg} strokeWidth={2.6} />}
                  </button>
                );
              })}
            </div>
          </div>

          <button style={{ ...primary2, marginTop: 32 }}>
            S'inscrire
            <Icon name="arrow-right" size={18} color="#fff" />
          </button>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14, color: T2.textMuted, fontFamily: T2.font }}>
            Déjà inscrit ?{' '}
            <a style={{ color: T2.terracotta, fontWeight: 800, textDecoration: 'none' }}>Se connecter</a>
          </div>
        </div>
      </ScrollBody2>
    </Phone2>
  );
}

function Field2({ label, defaultValue, placeholder, icon, trailing }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T2.textMuted,
        marginBottom: 8, letterSpacing: 0.4, textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: T2.surface, border: `1.5px solid ${T2.border}`,
        borderRadius: 14, padding: '14px 16px',
        boxShadow: T2.card,
      }}>
        {icon && <Icon name={icon} size={18} color={T2.textMuted} />}
        <input
          defaultValue={defaultValue} placeholder={placeholder}
          style={{
            flex: 1, border: 0, outline: 'none', background: 'transparent',
            fontFamily: T2.font, fontSize: 15, fontWeight: 600, color: T2.text, minWidth: 0,
          }}
        />
        {trailing}
      </div>
    </div>
  );
}

const primary2 = {
  all: 'unset', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  width: '100%', boxSizing: 'border-box',
  marginTop: 28,
  background: `linear-gradient(140deg, ${T2.blue}, ${T2.blueDeep})`,
  color: '#fff', borderRadius: 16,
  padding: '18px 0', textAlign: 'center',
  fontSize: 16, fontWeight: 800, letterSpacing: 0.4, fontFamily: T2.font,
  boxShadow: `0 12px 28px ${T2.blue}55`,
};

Object.assign(window, { SplashScreen2, LoginScreen2, RegisterScreen2, Field2, primary2 });
