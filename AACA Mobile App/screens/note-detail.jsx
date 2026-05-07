// Note detail — 3 tabs: Résumé / Contenu / Étudier
function NoteDetailScreen({ noteId, onBack, onTab, onOpenCapture, onStudy }) {
  const [tab, setTab] = React.useState('Résumé');
  const note = NOTES_DATA[noteId] || NOTES_DATA.n1;
  const c = T.subj[note.subject];

  return (
    <Phone>
      {/* header */}
      <div style={{
        position: 'absolute', top: 44, left: 0, right: 0, zIndex: 10,
        background: T.bg,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 14px',
        }}>
          <button onClick={onBack} style={iconBtnSm}>
            <Icon name="chevron-left" size={20} color={T.text} />
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={iconBtnSm}><Icon name="bookmark" size={18} color={T.text} /></button>
            <button style={iconBtnSm}><Icon name="upload" size={18} color={T.text} /></button>
          </div>
        </div>
      </div>

      <ScrollBody style={{ top: 44 }}>
        {/* hero — arch silhouette in subject color */}
        <div style={{ height: 50 }} />
        <div style={{
          position: 'relative', height: 130, margin: '0 16px', borderRadius: 22,
          background: `linear-gradient(150deg, ${c.fg}, ${c.fg}dd)`,
          overflow: 'hidden',
          boxShadow: `0 12px 28px ${c.fg}33`,
        }}>
          {/* moroccan arch outline */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0.18, pointerEvents: 'none',
          }}>
            <path d="M 10 100 L 10 50 Q 10 5 50 5 Q 90 5 90 50 L 90 100"
                  stroke="#fff" strokeWidth="0.8" fill="none" />
            <path d="M 18 100 L 18 50 Q 18 13 50 13 Q 82 13 82 50 L 82 100"
                  stroke="#fff" strokeWidth="0.8" fill="none" />
          </svg>
          {/* zellige overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: zelligeTile({ fg: '#ffffff', size: 30, opacity: 0.6 }),
            opacity: 0.16, pointerEvents: 'none',
          }} />
          {/* glyph */}
          <div style={{
            position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)',
            fontSize: 88, fontWeight: 800, color: '#fff', opacity: 0.28,
            lineHeight: 1, fontFamily: T.font,
          }}>{note.glyph}</div>
          <div style={{ position: 'absolute', left: 18, bottom: 14, right: 100 }}>
            <SubjectPill subject={note.subject} />
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 800, marginTop: 6, letterSpacing: -0.3, lineHeight: 1.25 }}>{note.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 4, fontWeight: 500 }}>
              {note.date} · {note.pages} pages · {note.cards} cartes
            </div>
          </div>
        </div>

        {/* gold divider */}
        <div style={{ padding: '14px 28px 0' }}>
          <GoldDivider />
        </div>

        {/* tab switcher */}
        <div style={{ padding: '14px 16px 8px' }}>
          <div style={{
            display: 'flex', background: T.surface, borderRadius: 14, padding: 4,
            border: `1px solid ${T.borderSoft}`, boxShadow: T.card,
          }}>
            {['Résumé', 'Contenu', 'Étudier'].map(t => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{
                  all: 'unset', flex: 1, textAlign: 'center', cursor: 'pointer',
                  padding: '8px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  fontFamily: T.font, letterSpacing: 0.1,
                  background: active ? T.cobalt : 'transparent',
                  color: active ? '#fff' : T.textMuted,
                  boxShadow: active ? '0 4px 10px rgba(27,79,216,0.25)' : 'none',
                  transition: 'all 0.18s',
                }}>{t}</button>
              );
            })}
          </div>
        </div>

        {/* tab content */}
        <div style={{ padding: '8px 16px 0' }}>
          {tab === 'Résumé' && <SummaryTab note={note} />}
          {tab === 'Contenu' && <ContentTab note={note} />}
          {tab === 'Étudier' && <StudyTab note={note} onStudy={onStudy} />}
        </div>

        <div style={{ height: 24 }} />
      </ScrollBody>

      <BottomNav active="notes" onChange={onTab} onCapture={onOpenCapture} />
    </Phone>
  );
}

const iconBtnSm = {
  all: 'unset', cursor: 'pointer',
  width: 38, height: 38, borderRadius: 999,
  background: T.surface, border: `1px solid ${T.borderSoft}`,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: T.card,
};

function SummaryTab({ note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* AI badge */}
      <div style={{
        display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
        background: T.cobaltSoft, color: T.cobalt,
        padding: '5px 10px', borderRadius: 999,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.1,
      }}>
        <Icon name="sparkle" size={12} /> Généré par IA · {note.summaryTime}
      </div>

      {/* TL;DR card */}
      <div style={{
        background: T.surface, borderRadius: 18, padding: 16,
        boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: T.textMuted, textTransform: 'uppercase' }}>L'essentiel</div>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: T.text, marginTop: 8, fontWeight: 500 }}>
          {note.tldr}
        </div>
      </div>

      {/* Key points */}
      <div style={{
        background: T.surface, borderRadius: 18, padding: 16,
        boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Points clés</div>
          <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{note.keyPoints.length} points</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {note.keyPoints.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: 999,
                background: T.cobaltSoft, color: T.cobalt,
                fontSize: 11, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, color: T.text }}>{p}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Formulae */}
      {note.formulae && (
        <div style={{
          background: T.surface, borderRadius: 18, padding: 16,
          boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 10 }}>Formules à retenir</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {note.formulae.map((f, i) => (
              <div key={i} style={{
                background: T.surfaceAlt, borderRadius: 10, padding: '12px 14px',
                border: `1px solid ${T.borderSoft}`,
                fontFamily: T.fontMono, fontSize: 14, fontWeight: 600, color: T.text,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                  background: T.gold,
                }} />
                <span style={{ paddingLeft: 6 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContentTab({ note }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* page tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '2px 0', scrollbarWidth: 'none' }}>
        {Array.from({ length: note.pages }).map((_, i) => (
          <div key={i} style={{
            flexShrink: 0, padding: '6px 12px', borderRadius: 999,
            background: i === 0 ? T.text : T.surface,
            color: i === 0 ? '#fff' : T.textMuted,
            fontSize: 12, fontWeight: 700, fontFamily: T.font,
            border: `1px solid ${i === 0 ? 'transparent' : T.borderSoft}`,
          }}>Page {i + 1}</div>
        ))}
      </div>

      {/* page preview — looks like extracted text */}
      <div style={{
        background: T.surface, borderRadius: 18, overflow: 'hidden',
        boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      }}>
        {/* mini photo strip */}
        <div style={{
          height: 80, background: `linear-gradient(135deg, ${T.surfaceAlt}, ${T.cobaltSoft})`,
          position: 'relative', borderBottom: `1px solid ${T.borderSoft}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 8, borderRadius: 10,
            background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-2deg)',
          }}>
            <Icon name="image" size={20} color={T.textFaint} />
            <span style={{ fontSize: 10, color: T.textFaint, marginLeft: 6, fontWeight: 600 }}>photo originale</span>
          </div>
          <div style={{
            position: 'absolute', top: 12, right: 14,
            background: T.cobalt, color: '#fff',
            fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Icon name="check" size={10} strokeWidth={3} /> OCR 99%
          </div>
        </div>
        {/* extracted text */}
        <div style={{ padding: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: -0.2 }}>{note.title}</h3>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {note.body.map((para, i) => (
              <p key={i} style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.text }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={miniBtn}><Icon name="sparkle" size={13} /> Reformuler</button>
        <button style={miniBtn}><Icon name="globe" size={13} /> Traduire</button>
      </div>
    </div>
  );
}

function StudyTab({ note, onStudy }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Big CTA */}
      <button onClick={onStudy} style={{
        all: 'unset', cursor: 'pointer', display: 'block',
        background: `linear-gradient(140deg, ${T.cobalt}, ${T.cobaltDeep})`,
        borderRadius: 18, padding: '16px 18px', color: '#fff',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 12px 28px rgba(27,79,216,0.30)',
      }}>
        <div style={{
          position: 'absolute', right: -20, top: -20, width: 140, height: 140,
          backgroundImage: zelligeTile({ fg: '#fff', size: 28, opacity: 0.55 }),
          opacity: 0.15, pointerEvents: 'none',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: 0.4, textTransform: 'uppercase' }}>Mode étude</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginTop: 2 }}>Démarrer la révision</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>{note.cards} cartes · ≈ 6 min</div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: 'rgba(255,255,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.35)',
          }}>
            <Icon name="play" size={18} color="#fff" strokeWidth={2} />
          </div>
        </div>
      </button>

      {/* Mode picker */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { ic: 'cards', label: 'Flashcards', sub: `${note.cards} cartes`, c: T.terracotta, bg: T.terracottaSoft },
          { ic: 'check', label: 'QCM',        sub: '12 questions',         c: '#1F8A5B',     bg: '#E2F1EA' },
          { ic: 'lightning', label: 'Examen blanc', sub: '20 min · noté',  c: T.gold,        bg: T.goldSoft },
          { ic: 'sparkle', label: 'IA Tuteur',     sub: 'pose tes questions', c: T.cobalt,   bg: T.cobaltSoft },
        ].map((m, i) => (
          <button key={i} style={{
            all: 'unset', cursor: 'pointer',
            background: T.surface, borderRadius: 16, padding: 14,
            boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
            display: 'flex', flexDirection: 'column', gap: 8,
            fontFamily: T.font,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: m.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={m.ic} size={18} color={m.c} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{m.label}</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>{m.sub}</div>
          </button>
        ))}
      </div>

      {/* progress */}
      <div style={{
        background: T.surface, borderRadius: 16, padding: 14,
        boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Maîtrise</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.cobalt }}>62%</span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {[ {w: 35, c: '#1F8A5B'}, {w: 27, c: T.saffron}, {w: 38, c: T.terracotta}].map((s,i) => (
            <div key={i} style={{ flex: s.w, height: 8, borderRadius: 4, background: s.c }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#1F8A5B' }} /> Maîtrisé · 7
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: T.saffron }} /> En cours · 5
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: T.terracotta }} /> Difficile · 6
          </span>
        </div>
      </div>
    </div>
  );
}

const miniBtn = {
  all: 'unset', cursor: 'pointer',
  flex: 1, textAlign: 'center',
  background: T.surface, border: `1px solid ${T.borderSoft}`,
  borderRadius: 12, padding: '10px 12px',
  fontSize: 12, fontWeight: 700, color: T.text,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontFamily: T.font,
};

const NOTES_DATA = {
  n1: {
    subject: 'Math', glyph: '∫',
    title: 'Intégrales par parties',
    date: '4 mai 2026',
    pages: 4, cards: 18,
    summaryTime: 'il y a 2h',
    tldr: 'L\'intégration par parties transforme une intégrale produit en intégrale plus simple, à partir de la formule ∫u·dv = u·v − ∫v·du. Choisir u via la règle ALPES.',
    keyPoints: [
      'Formule de base : ∫u·dv = u·v − ∫v·du, dérivée de la dérivée d\'un produit.',
      'Règle ALPES pour choisir u : Algébrique > Logarithme > Polynôme > Exponentielle > Sinus/Cosinus.',
      'Applications types : ∫x·eˣ dx, ∫x·ln(x) dx, ∫x²·sin(x) dx.',
      'L\'intégration par parties peut être appliquée plusieurs fois jusqu\'à obtenir une primitive immédiate.',
    ],
    formulae: [
      '∫ u dv = uv − ∫ v du',
      '∫ x eˣ dx = (x − 1) eˣ + C',
      '∫ ln(x) dx = x ln(x) − x + C',
    ],
    body: [
      'L\'intégration par parties est une technique d\'intégration qui s\'applique aux produits de fonctions. Elle découle directement de la formule de dérivation d\'un produit : (uv)′ = u′v + uv′.',
      'En intégrant cette équation, on obtient la formule fondamentale ∫u·dv = u·v − ∫v·du. Le choix judicieux de u et dv simplifie le calcul.',
      'La règle mnémotechnique ALPES (Algébrique, Logarithme, Polynôme, Exponentielle, Sinus) permet de choisir u en priorité dans cet ordre.',
    ],
  },
  n2: {
    subject: 'Physics', glyph: 'φ',
    title: 'Mécanique quantique — fonctions d\'onde',
    date: '3 mai 2026', pages: 6, cards: 24,
    summaryTime: 'hier',
    tldr: 'La fonction d\'onde ψ(x,t) décrit l\'état quantique d\'une particule. |ψ|² donne la densité de probabilité de présence. Elle obéit à l\'équation de Schrödinger.',
    keyPoints: [
      'ψ(x,t) est une fonction complexe représentant l\'amplitude de probabilité.',
      '|ψ(x,t)|² = densité de probabilité — interprétation de Born.',
      'Normalisation : ∫|ψ|² dx = 1 sur tout l\'espace.',
      'Équation de Schrödinger dépendante du temps : iℏ ∂ψ/∂t = Ĥψ.',
    ],
    formulae: [
      'iℏ ∂ψ/∂t = −(ℏ²/2m) ∇²ψ + V(x)ψ',
      '∫ |ψ(x,t)|² dx = 1',
      'ΔxΔp ≥ ℏ/2',
    ],
    body: [
      'La fonction d\'onde ψ(x,t) est l\'objet fondamental de la mécanique quantique. Elle contient toute l\'information physique sur le système.',
      'Selon l\'interprétation de Born, |ψ(x,t)|² représente la densité de probabilité de trouver la particule au point x à l\'instant t.',
      'L\'évolution temporelle de ψ est régie par l\'équation de Schrödinger, équation centrale de la mécanique ondulatoire.',
    ],
  },
};

Object.assign(window, { NoteDetailScreen, NOTES_DATA });
