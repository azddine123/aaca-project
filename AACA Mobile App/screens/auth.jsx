// Splash · Login · Register — auth flow

// AACA mark — interlocking 8-point star + monogram
function AACAMark({ size = 72, color = '#fff', accent = '#D4A017' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      {/* outer rotated square (8-point base) */}
      <g fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round">
        <rect x="20" y="20" width="60" height="60" rx="4" />
        <rect x="20" y="20" width="60" height="60" rx="4" transform="rotate(45 50 50)" />
      </g>
      {/* gold inner ring */}
      <circle cx="50" cy="50" r="18" fill="none" stroke={accent} strokeWidth="1.5" />
      {/* center monogram */}
      <text x="50" y="58" textAnchor="middle"
            fontFamily='"Plus Jakarta Sans", sans-serif'
            fontSize="22" fontWeight="800" fill={color}
            letterSpacing="-1">A</text>
      {/* corner dots */}
      {[[12,50],[88,50],[50,12],[50,88]].map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="2" fill={accent} />
      ))}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────
function SplashScreen() {
  return (
    <Phone style={{ background: T.cobaltDeep }}>
      {/* full-bleed zellige */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: zelligeTile({ fg: '#ffffff', size: 38, opacity: 0.7 }),
        opacity: 0.10,
      }} />
      {/* radial vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `radial-gradient(ellipse at 50% 40%, ${T.cobalt}00 0%, ${T.cobaltDeep}cc 70%, ${T.cobaltDeep} 100%)`,
      }} />
      {/* arabesque ornament behind logo */}
      <ArabesqueOrnament size={360} color="#ffffff" opacity={0.10}
        style={{ position: 'absolute', left: '50%', top: '38%', transform: 'translate(-50%, -50%)' }}
      />

      {/* center stack */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontFamily: T.font, padding: 24, textAlign: 'center',
        zIndex: 5,
      }}>
        {/* logo cartouche */}
        <div style={{
          width: 120, height: 120, borderRadius: 32,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 30px 60px rgba(0,0,0,0.3)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: zelligeTile({ fg: '#fff', size: 22, opacity: 0.9 }),
            opacity: 0.18,
          }} />
          <AACAMark size={84} />
        </div>

        {/* name in Arabic */}
        <div style={{
          marginTop: 26, fontSize: 28, fontWeight: 700,
          fontFamily: '"Amiri", "Noto Naskh Arabic", "Plus Jakarta Sans", serif',
          color: T.gold, letterSpacing: 1, direction: 'rtl',
        }}>
          المساعد المعرفي الأكاديمي
        </div>

        {/* gold ornamental divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 14px', width: 220 }}>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
          <svg width="18" height="18" viewBox="0 0 18 18">
            <g fill="none" stroke={T.gold} strokeWidth="1.2">
              <path d="M9 1 L17 9 L9 17 L1 9 Z" />
              <path d="M9 4 L14 9 L9 14 L4 9 Z" />
              <circle cx="9" cy="9" r="1.5" fill={T.gold} />
            </g>
          </svg>
          <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${T.gold}, transparent)` }} />
        </div>

        {/* name in French + acronym */}
        <div style={{
          fontSize: 36, fontWeight: 800, letterSpacing: 6,
          color: '#fff',
        }}>AACA</div>
        <div style={{
          marginTop: 4, fontSize: 12, fontWeight: 600,
          color: 'rgba(255,255,255,0.75)', letterSpacing: 2.5, textTransform: 'uppercase',
        }}>
          Assistant cognitif académique
        </div>

        <div style={{ flex: 1 }} />
      </div>

      {/* bottom band — loader + tagline */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 60,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        fontFamily: T.font, color: 'rgba(255,255,255,0.75)',
        zIndex: 5,
      }}>
        {/* zellige loader band */}
        <div style={{ width: 140, position: 'relative' }}>
          <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
            <div style={{ width: '60%', height: '100%', background: T.gold, borderRadius: 999 }} />
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6 }}>Chargement de l'IA…</div>
      </div>

      {/* bottom watermark band */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 14,
        backgroundImage: zelligeTile({ fg: T.gold, size: 22, opacity: 1 }),
        opacity: 0.4,
      }} />

      {/* white home indicator on dark */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.7)', zIndex: 60,
      }} />
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const [email, setEmail] = React.useState('yasmine.elamrani@um6p.ma');
  const [pw, setPw] = React.useState('••••••••••');
  const [showPw, setShowPw] = React.useState(false);
  return (
    <Phone>
      {/* zellige top band — decorative */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 100,
        background: T.cobaltDeep, overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: zelligeTile({ fg: '#fff', size: 28, opacity: 0.7 }),
          opacity: 0.18,
        }} />
        <ZelligeBand color={T.gold} opacity={0.85} height={14}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        />
      </div>

      <ScrollBody style={{ top: 0 }} padBottom={20}>
        <div style={{ height: 100 }} />

        {/* card centered, slightly overlapping band */}
        <div style={{ padding: '0 18px', marginTop: -42 }}>
          <div style={{
            background: T.surface, borderRadius: 24,
            boxShadow: '0 20px 50px rgba(15,30,80,0.16), 0 0 0 1px ' + T.borderSoft,
            padding: '24px 22px 22px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* logo medallion sits in card top */}
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: `linear-gradient(140deg, ${T.cobalt}, ${T.cobaltDeep})`,
              boxShadow: '0 10px 24px rgba(27,79,216,0.32)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: zelligeTile({ fg: '#fff', size: 18, opacity: 0.9 }),
                opacity: 0.18,
              }} />
              <AACAMark size={44} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>
                Bon retour
              </h1>
              <div style={{ marginTop: 4, fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
                Connectez-vous pour reprendre vos révisions
              </div>
            </div>

            {/* gold divider with diamond */}
            <div style={{ padding: '14px 8px 18px' }}>
              <GoldDivider />
            </div>

            {/* fields */}
            <Field label="Email" value={email} icon="globe" />
            <div style={{ height: 12 }} />
            <Field label="Mot de passe" value={pw} icon="bookmark" trailing={
              <button onClick={() => setShowPw(s => !s)} style={{
                all: 'unset', cursor: 'pointer',
                fontSize: 11, fontWeight: 700, color: T.cobalt,
                fontFamily: T.font,
              }}>{showPw ? 'Masquer' : 'Afficher'}</button>
            } />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                <span style={{
                  width: 16, height: 16, borderRadius: 5,
                  background: T.cobalt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="check" size={11} color="#fff" strokeWidth={3} />
                </span>
                Se souvenir de moi
              </label>
              <a style={{ fontSize: 12, fontWeight: 700, color: T.cobalt, textDecoration: 'none' }}>Mot de passe oublié ?</a>
            </div>

            {/* primary button */}
            <button style={primaryBtn}>
              Se connecter
              <Icon name="arrow-right" size={16} color="#fff" />
            </button>

            {/* divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: T.borderSoft }} />
              <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>ou continuer avec</span>
              <div style={{ flex: 1, height: 1, background: T.borderSoft }} />
            </div>

            {/* social */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SocialBtn label="Google" />
              <SocialBtn label="Apple" dark />
            </div>
          </div>

          {/* sign-up link */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: T.textMuted, fontFamily: T.font }}>
            Pas encore de compte ?{' '}
            <a style={{ color: T.cobalt, fontWeight: 800, textDecoration: 'none' }}>Créer un compte</a>
          </div>

          {/* arabic tagline */}
          <div style={{
            marginTop: 18, textAlign: 'center', fontSize: 14, color: T.textFaint,
            fontFamily: '"Amiri", serif', direction: 'rtl', fontWeight: 500,
          }}>
            تعلّم بذكاء، راجع بثقة
          </div>
        </div>
      </ScrollBody>

      {/* home indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.25)', zIndex: 60,
      }} />
    </Phone>
  );
}

function Field({ label, value, icon, trailing }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`,
        borderRadius: 12, padding: '12px 14px',
      }}>
        {icon && <Icon name={icon} size={16} color={T.textMuted} />}
        <input
          defaultValue={value}
          style={{
            flex: 1, border: 0, outline: 'none', background: 'transparent',
            fontFamily: T.font, fontSize: 14, fontWeight: 500, color: T.text, minWidth: 0,
          }}
        />
        {trailing}
      </div>
    </div>
  );
}

const primaryBtn = {
  all: 'unset', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  width: '100%', boxSizing: 'border-box',
  marginTop: 18,
  background: `linear-gradient(140deg, ${T.cobalt}, ${T.cobaltDeep})`,
  color: '#fff', borderRadius: 14,
  padding: '14px 0', textAlign: 'center',
  fontSize: 14, fontWeight: 800, letterSpacing: 0.3, fontFamily: T.font,
  boxShadow: '0 10px 22px rgba(27,79,216,0.32)',
};

function SocialBtn({ label, dark }) {
  return (
    <button style={{
      all: 'unset', cursor: 'pointer',
      background: dark ? '#000' : T.surface, color: dark ? '#fff' : T.text,
      border: `1px solid ${dark ? '#000' : T.borderSoft}`,
      borderRadius: 12, padding: '11px 0',
      textAlign: 'center', fontSize: 13, fontWeight: 700, fontFamily: T.font,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {label === 'Google' ? (
        <svg width="16" height="16" viewBox="0 0 18 18">
          <path fill="#EA4335" d="M9 3.6c1.3 0 2.4.5 3.3 1.3l2.5-2.4C13.3 1.2 11.3.4 9 .4 5.5.4 2.4 2.4.9 5.4l2.9 2.3C4.6 5.3 6.6 3.6 9 3.6z"/>
          <path fill="#4285F4" d="M17.6 9.2c0-.6 0-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2-1.8 2.6l2.8 2.2c1.6-1.5 2.8-3.7 2.8-6.4z"/>
          <path fill="#FBBC05" d="M3.8 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7L.9 5C.3 6.2 0 7.6 0 9s.3 2.8.9 4l2.9-2.3z"/>
          <path fill="#34A853" d="M9 17.6c2.3 0 4.3-.8 5.7-2.1l-2.8-2.2c-.8.5-1.7.8-2.9.8-2.4 0-4.4-1.6-5.2-3.9L.9 12.5C2.4 15.5 5.5 17.6 9 17.6z"/>
        </svg>
      ) : (
        <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
          <path d="M11.6 8.5c0-2 1.6-2.9 1.7-3-1-1.3-2.3-1.5-2.8-1.5-1.2-.1-2.3.7-2.9.7s-1.5-.7-2.5-.6c-1.3 0-2.5.7-3.2 1.9-1.4 2.3-.4 5.8 1 7.7.7.9 1.5 2 2.5 1.9.9 0 1.4-.6 2.6-.6s1.6.6 2.6.6 1.7-.9 2.4-1.9c.7-1 1-2 1-2-.1 0-2-.7-2-2.9zM9.7 2.7c.5-.6.9-1.5.7-2.4-.8.1-1.7.5-2.3 1.2-.5.6-.9 1.5-.7 2.4.8 0 1.7-.5 2.3-1.2z"/>
        </svg>
      )}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────
function RegisterScreen() {
  const [picked, setPicked] = React.useState(['Math', 'Physics']);
  const toggle = (s) => setPicked(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  const subjects = ['Math', 'Physics', 'Biology', 'CS', 'Chimie', 'Histoire'];
  const labels = { Math: 'Mathématiques', Physics: 'Physique', Biology: 'Biologie', CS: 'Informatique', Chimie: 'Chimie', Histoire: 'Histoire' };

  return (
    <Phone>
      {/* Moroccan arch header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 220,
        overflow: 'hidden',
      }}>
        {/* arch silhouette using clip-path */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(160deg, ${T.cobalt} 0%, ${T.cobaltDeep} 100%)`,
          clipPath: 'path("M 0 0 L 0 140 Q 0 60 50 60 Q 100 60 100 140 L 100 0 Z")',
          // The clip-path uses % only — let SVG do it for proper 100x100 -> full size scaling.
          // We'll override below with an SVG approach for safety.
        }} />
        {/* precise arch via SVG mask — covers full width */}
        <svg viewBox="0 0 390 220" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="archGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={T.cobalt} />
              <stop offset="1" stopColor={T.cobaltDeep} />
            </linearGradient>
            <pattern id="archZellige" patternUnits="userSpaceOnUse" width="32" height="32">
              <g fill="none" stroke="#fff" strokeWidth="0.7" opacity="0.18">
                <rect x="6" y="6" width="20" height="20"/>
                <rect x="6" y="6" width="20" height="20" transform="rotate(45 16 16)"/>
                <circle cx="16" cy="16" r="1.5"/>
              </g>
            </pattern>
          </defs>
          {/* horseshoe arch path — wide curve top, slight bell */}
          <path d="M 0 0 L 0 220 L 80 220 L 80 130 Q 80 60 195 60 Q 310 60 310 130 L 310 220 L 390 220 L 390 0 Z" fill="url(#archGrad)" />
          <path d="M 0 0 L 0 220 L 80 220 L 80 130 Q 80 60 195 60 Q 310 60 310 130 L 310 220 L 390 220 L 390 0 Z" fill="url(#archZellige)" />
          {/* gold inner trim along arch */}
          <path d="M 80 220 L 80 130 Q 80 60 195 60 Q 310 60 310 130 L 310 220" fill="none" stroke={T.gold} strokeWidth="1.5" opacity="0.7" />
          <path d="M 90 220 L 90 134 Q 90 70 195 70 Q 300 70 300 134 L 300 220" fill="none" stroke={T.gold} strokeWidth="0.6" opacity="0.5" />
        </svg>

        {/* Title */}
        <div style={{
          position: 'absolute', top: 90, left: 0, right: 0,
          textAlign: 'center', color: '#fff', fontFamily: T.font,
        }}>
          <button style={{
            position: 'absolute', left: 14, top: -34,
            all: 'unset', cursor: 'pointer',
            width: 36, height: 36, borderRadius: 999,
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.22)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(20px)',
          }}>
            <Icon name="chevron-left" size={18} color="#fff" />
          </button>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4 }}>Créer un compte</div>
          <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85, marginTop: 2 }}>
            Rejoignez la communauté AACA
          </div>
        </div>
      </div>

      <ScrollBody style={{ top: 44 }} padBottom={30}>
        <div style={{ height: 196 }} />

        {/* form card */}
        <div style={{ padding: '0 16px' }}>
          <div style={{
            background: T.surface, borderRadius: 22,
            boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
            padding: '20px 18px',
          }}>
            <Field label="Nom complet" value="Yasmine El Amrani" icon="profile" />
            <div style={{ height: 12 }} />
            <Field label="Email" value="yasmine.elamrani@um6p.ma" icon="globe" />
            <div style={{ height: 12 }} />
            <Field label="Mot de passe" value="••••••••" icon="bookmark" />

            <div style={{ height: 12 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>Établissement</div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`,
                borderRadius: 12, padding: '12px 14px',
              }}>
                <Icon name="study" size={16} color={T.textMuted} />
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text, fontFamily: T.font }}>UM6P · Benguérir</div>
                <Icon name="chevron" size={14} color={T.textFaint} />
              </div>
              <div style={{ fontSize: 11, color: T.textFaint, marginTop: 6, fontWeight: 500 }}>
                Université, lycée ou école — utilisé pour adapter le contenu
              </div>
            </div>
          </div>

          {/* subject preferences */}
          <div style={{
            background: T.surface, borderRadius: 22,
            boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
            padding: '18px 18px',
            marginTop: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Matières préférées</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 500 }}>Sélectionnez au moins 2 matières</div>
              </div>
              <span style={{
                background: T.cobaltSoft, color: T.cobalt,
                fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
              }}>{picked.length} / 6</span>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {subjects.map(s => {
                const active = picked.includes(s);
                const c = T.subj[s];
                return (
                  <button key={s} onClick={() => toggle(s)} style={{
                    all: 'unset', cursor: 'pointer',
                    padding: '11px 12px', borderRadius: 12,
                    background: active ? c.soft : T.surface,
                    border: `1.5px solid ${active ? c.fg : T.borderSoft}`,
                    display: 'flex', alignItems: 'center', gap: 9, fontFamily: T.font,
                    boxShadow: active ? `0 4px 10px ${c.fg}20` : 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: active ? c.fg : c.soft,
                      color: active ? '#fff' : c.fg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 800, flexShrink: 0,
                    }}>{({Math:'∫',Physics:'φ',Biology:'⌬',CS:'{',Chimie:'⚗',Histoire:'§'})[s]}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labels[s]}</div>
                    </div>
                    {active && (
                      <div style={{
                        width: 18, height: 18, borderRadius: 999,
                        background: c.fg, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Icon name="check" size={11} color="#fff" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* terms */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '14px 4px 0', fontFamily: T.font,
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 6, marginTop: 2, flexShrink: 0,
              background: T.cobalt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="check" size={12} color="#fff" strokeWidth={3} />
            </span>
            <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, fontWeight: 500 }}>
              J'accepte les <a style={{ color: T.cobalt, fontWeight: 700, textDecoration: 'none' }}>conditions d'utilisation</a> et la <a style={{ color: T.cobalt, fontWeight: 700, textDecoration: 'none' }}>politique de confidentialité</a>.
            </div>
          </div>

          {/* primary */}
          <button style={primaryBtn}>
            S'inscrire
            <Icon name="arrow-right" size={16} color="#fff" />
          </button>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: T.textMuted, fontFamily: T.font }}>
            Déjà inscrit ?{' '}
            <a style={{ color: T.cobalt, fontWeight: 800, textDecoration: 'none' }}>Se connecter</a>
          </div>
        </div>
      </ScrollBody>

      <div style={{
        position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
        width: 134, height: 5, borderRadius: 999, background: 'rgba(0,0,0,0.25)', zIndex: 60,
      }} />
    </Phone>
  );
}

Object.assign(window, { SplashScreen, LoginScreen, RegisterScreen, AACAMark });
