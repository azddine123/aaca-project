// Study screen — toggle between Flashcard mode (3D flip) and MCQ Quiz
function StudyScreen({ onBack, onTab, onOpenCapture }) {
  const [mode, setMode] = React.useState('flash'); // 'flash' | 'quiz'
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
            <Icon name="x" size={20} color={T.text} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Intégrales par parties</div>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600 }}>Math · Session</div>
          </div>
          <button style={iconBtnSm}>
            <Icon name="shuffle" size={16} color={T.text} />
          </button>
        </div>
        {/* mode toggle */}
        <div style={{ padding: '6px 16px 8px' }}>
          <div style={{
            display: 'flex', background: T.surface, borderRadius: 12, padding: 3,
            border: `1px solid ${T.borderSoft}`,
          }}>
            {[{ k: 'flash', label: 'Flashcards', ic: 'cards' }, { k: 'quiz', label: 'QCM', ic: 'check' }].map(m => {
              const active = mode === m.k;
              return (
                <button key={m.k} onClick={() => setMode(m.k)} style={{
                  all: 'unset', flex: 1, textAlign: 'center', cursor: 'pointer',
                  padding: '8px 0', borderRadius: 9, fontSize: 12, fontWeight: 700,
                  fontFamily: T.font,
                  background: active ? T.text : 'transparent',
                  color: active ? '#fff' : T.textMuted,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.18s',
                }}>
                  <Icon name={m.ic} size={13} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ScrollBody style={{ top: 44, bottom: 0 }} padBottom={120}>
        <div style={{ height: 100 }} />
        {mode === 'flash' ? <FlashcardMode /> : <QuizMode />}
      </ScrollBody>

      <BottomNav active="study" onChange={onTab} onCapture={onOpenCapture} />
    </Phone>
  );
}

function FlashcardMode() {
  const [idx, setIdx] = React.useState(2);
  const [flipped, setFlipped] = React.useState(false);
  const card = FLASHCARDS[idx];
  const total = FLASHCARDS.length;

  const next = (rating) => {
    setFlipped(false);
    setTimeout(() => setIdx(i => Math.min(i + 1, total - 1)), 180);
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, minWidth: 30 }}>{idx + 1}/{total}</span>
        <div style={{ flex: 1, height: 5, borderRadius: 999, background: T.borderSoft, overflow: 'hidden' }}>
          <div style={{ width: `${((idx + 1) / total) * 100}%`, height: '100%', background: `linear-gradient(90deg, ${T.cobalt}, ${T.gold})`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* card */}
      <div style={{
        perspective: 1500, height: 380, position: 'relative',
      }}>
        <div onClick={() => setFlipped(f => !f)} style={{
          width: '100%', height: '100%', position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
          cursor: 'pointer',
        }}>
          {/* FRONT */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            background: T.surface, borderRadius: 22,
            boxShadow: '0 20px 50px rgba(20,30,60,0.16), 0 2px 8px rgba(20,30,60,0.06)',
            border: `1px solid ${T.borderSoft}`,
            padding: 24, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* gold corners */}
            <div style={{ position: 'absolute', top: 14, left: 14, fontSize: 11, fontWeight: 700, color: T.textFaint, letterSpacing: 1.2, textTransform: 'uppercase' }}>Question</div>
            <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: T.terracotta }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: T.terracotta }}>DIFFICILE</span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px 8px' }}>
              <SubjectPill subject="Math" />
              <div style={{ fontSize: 22, fontWeight: 700, color: T.text, marginTop: 14, lineHeight: 1.35, letterSpacing: -0.3 }}>
                {card.q}
              </div>
              {card.formula && (
                <div style={{
                  marginTop: 18, padding: '14px 18px',
                  background: T.surfaceAlt, borderRadius: 12,
                  border: `1px solid ${T.borderSoft}`,
                  fontFamily: T.fontMono, fontSize: 18, fontWeight: 600, color: T.cobalt,
                }}>
                  {card.formula}
                </div>
              )}
            </div>

            {/* footer hint */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: T.textFaint,
              padding: 8, borderTop: `1px solid ${T.borderSoft}`,
            }}>
              <Icon name="rotate" size={12} color={T.textFaint} /> Touchez pour révéler
            </div>
          </div>

          {/* BACK — zellige geometric pattern background */}
          <div style={{
            position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: T.surface, borderRadius: 22,
            boxShadow: '0 20px 50px rgba(20,30,60,0.16), 0 2px 8px rgba(20,30,60,0.06)',
            border: `1px solid ${T.borderSoft}`,
            padding: 24, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* zellige back pattern */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: zelligeTile({ fg: T.cobalt, size: 36, opacity: 0.6 }),
              opacity: 0.07, pointerEvents: 'none',
            }} />
            {/* arabesque watermark */}
            <ArabesqueOrnament size={260} color={T.cobalt} opacity={0.06}
              style={{ position: 'absolute', right: -50, bottom: -60 }}
            />
            {/* gold border-frame */}
            <div style={{
              position: 'absolute', inset: 10, borderRadius: 16,
              border: `1px solid ${T.gold}66`, pointerEvents: 'none',
            }} />

            <div style={{ position: 'absolute', top: 14, left: 14, fontSize: 11, fontWeight: 700, color: T.cobalt, letterSpacing: 1.2, textTransform: 'uppercase' }}>Réponse</div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 12px', position: 'relative' }}>
              {card.formula && (
                <div style={{
                  fontFamily: T.fontMono, fontSize: 20, fontWeight: 700, color: T.cobalt,
                  background: '#fff', padding: '12px 18px', borderRadius: 10,
                  border: `1px solid ${T.cobaltSoft}`,
                  boxShadow: '0 2px 6px rgba(27,79,216,0.08)',
                  marginBottom: 14,
                }}>{card.formulaA}</div>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.55, color: T.text, fontWeight: 500 }}>
                {card.a}
              </div>
              {card.tip && (
                <div style={{
                  marginTop: 14, padding: '10px 12px',
                  background: T.goldSoft, borderRadius: 10,
                  border: `1px solid ${T.gold}55`,
                  fontSize: 12, color: '#7d5e0c', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <Icon name="sparkle" size={13} color={T.gold} /> {card.tip}
                </div>
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: T.textFaint,
              padding: 8, borderTop: `1px solid ${T.borderSoft}`,
              position: 'relative',
            }}>
              <Icon name="rotate" size={12} color={T.textFaint} /> Touchez pour retourner
            </div>
          </div>
        </div>
      </div>

      {/* gold divider */}
      <div style={{ padding: '20px 8px 16px' }}>
        <GoldDivider ornament />
      </div>

      {/* rating buttons — appear when flipped */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
        opacity: flipped ? 1 : 0.4,
        transition: 'opacity 0.3s',
        pointerEvents: flipped ? 'auto' : 'none',
      }}>
        {[
          { lbl: 'Difficile', sub: 'Revoir', c: T.terracotta, bg: T.terracottaSoft },
          { lbl: 'Moyen',     sub: '3 j',    c: T.saffron,    bg: T.saffronSoft },
          { lbl: 'Facile',    sub: '7 j',    c: '#1F8A5B',    bg: '#E2F1EA' },
        ].map((r, i) => (
          <button key={i} onClick={() => next(r.lbl)} style={{
            all: 'unset', cursor: 'pointer',
            background: r.bg, color: r.c,
            borderRadius: 14, padding: '12px 8px', textAlign: 'center',
            border: `1px solid ${r.c}30`,
            fontFamily: T.font,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.lbl}</div>
            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, marginTop: 1 }}>{r.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function QuizMode() {
  const [selected, setSelected] = React.useState(null);
  const [revealed, setRevealed] = React.useState(false);
  const q = QUIZ[0];

  const pick = (i) => {
    if (revealed) return;
    setSelected(i);
    setTimeout(() => setRevealed(true), 280);
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, minWidth: 30 }}>3/12</span>
        <div style={{ flex: 1, height: 5, borderRadius: 999, background: T.borderSoft, overflow: 'hidden' }}>
          <div style={{ width: '25%', height: '100%', background: `linear-gradient(90deg, ${T.cobalt}, ${T.gold})` }} />
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: T.cobaltSoft, color: T.cobalt,
          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
        }}>
          <Icon name="clock" size={11} /> 0:42
        </span>
      </div>

      {/* question card */}
      <div style={{
        background: T.surface, borderRadius: 20, padding: 18,
        boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${T.cobalt}, ${T.gold})` }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <SubjectPill subject="Math" />
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textFaint, letterSpacing: 1.2, textTransform: 'uppercase' }}>Question 3</span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text, lineHeight: 1.4, letterSpacing: -0.2 }}>
          {q.question}
        </div>
        {q.formula && (
          <div style={{
            marginTop: 12, padding: '12px 14px',
            background: T.surfaceAlt, borderRadius: 10,
            border: `1px solid ${T.borderSoft}`,
            fontFamily: T.fontMono, fontSize: 16, fontWeight: 600, color: T.cobalt,
            textAlign: 'center',
          }}>{q.formula}</div>
        )}
      </div>

      {/* options */}
      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {q.options.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = revealed && i === q.correct;
          const isWrong = revealed && isSelected && i !== q.correct;
          let bg = T.surface, border = T.borderSoft, color = T.text, ringC = null;
          if (isCorrect) { bg = '#E2F1EA'; border = '#1F8A5B'; color = '#0F5A36'; ringC = '#1F8A5B'; }
          else if (isWrong) { bg = T.terracottaSoft; border = T.terracotta; color = '#7a2a08'; ringC = T.terracotta; }
          else if (isSelected) { bg = T.cobaltSoft; border = T.cobalt; color = T.cobaltDeep; ringC = T.cobalt; }

          return (
            <button key={i} onClick={() => pick(i)} disabled={revealed} style={{
              all: 'unset', cursor: revealed ? 'default' : 'pointer',
              background: bg, color, borderRadius: 14, padding: '14px 14px',
              border: `1.5px solid ${border}`,
              boxShadow: isSelected ? `0 4px 14px ${ringC}30` : '0 1px 2px rgba(20,30,60,0.04)',
              display: 'flex', alignItems: 'center', gap: 12,
              fontFamily: T.font,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: ringC ? ringC : '#fff',
                color: ringC ? '#fff' : T.textMuted,
                border: ringC ? 'none' : `1.5px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800,
                flexShrink: 0,
              }}>
                {isCorrect ? <Icon name="check" size={14} color="#fff" strokeWidth={3} /> :
                 isWrong   ? <Icon name="x" size={14} color="#fff" strokeWidth={3} /> :
                 ['A','B','C','D'][i]}
              </div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, fontFamily: opt.startsWith('∫') ? T.fontMono : T.font }}>
                {opt}
              </div>
            </button>
          );
        })}
      </div>

      {/* explanation when revealed */}
      {revealed && (
        <div style={{
          marginTop: 14,
          background: T.cobaltSoft, borderRadius: 14, padding: 14,
          border: `1px solid ${T.cobalt}33`,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <Icon name="sparkle" size={16} color={T.cobalt} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.cobaltDeep, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 4 }}>Explication</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: T.cobaltDeep }}>{q.explain}</div>
          </div>
        </div>
      )}

      {revealed && (
        <button style={{
          all: 'unset', cursor: 'pointer', display: 'block',
          width: '100%', boxSizing: 'border-box', textAlign: 'center',
          marginTop: 14,
          background: T.cobalt, color: '#fff',
          borderRadius: 14, padding: '14px 0',
          fontSize: 14, fontWeight: 800, fontFamily: T.font, letterSpacing: 0.2,
          boxShadow: '0 8px 20px rgba(27,79,216,0.32)',
        }}>
          Question suivante <Icon name="arrow-right" size={14} color="#fff" style={{ verticalAlign: 'middle', marginLeft: 4 }} />
        </button>
      )}
    </div>
  );
}

const FLASHCARDS = [
  { q: 'Quelle est la formule générale de l\'intégration par parties ?', formula: '∫ u dv = ?', formulaA: '∫ u dv = uv − ∫ v du', a: 'Cette formule provient de la dérivation d\'un produit (uv)′ = u′v + uv′.', tip: 'Astuce ALPES : choisir u dans cet ordre.' },
  { q: 'Calculez ∫ x eˣ dx', a: 'Avec u = x et dv = eˣdx, on obtient :', formula: '∫ x eˣ dx', formulaA: '(x − 1)eˣ + C' },
  { q: 'Calculez ∫ ln(x) dx', a: 'Astuce : poser u = ln(x), dv = dx.', formula: '∫ ln(x) dx', formulaA: 'x ln(x) − x + C', tip: 'Le ln se dérive bien — utilise-le comme u.' },
];

const QUIZ = [
  {
    question: 'Selon la règle ALPES, quel terme choisir comme u dans cette intégrale ?',
    formula: '∫ x · ln(x) dx',
    options: ['x (Polynôme)', 'ln(x) (Logarithme)', 'dx (différentielle)', 'aucun, on factorise'],
    correct: 1,
    explain: 'La règle ALPES priorise le Logarithme avant le Polynôme — donc u = ln(x), dv = x dx.',
  },
];

Object.assign(window, { StudyScreen });
