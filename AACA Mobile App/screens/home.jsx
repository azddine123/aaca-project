// Home screen — study streak, recent notes, flashcards due, quick stats
function HomeScreen({ onOpenNote, onOpenCapture, onTab }) {
  return (
    <Phone>
      <ScrollBody>
        {/* Header — greeting + streak */}
        <div style={{ padding: '4px 20px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>Bonjour, Yasmine</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6, marginTop: 2, color: T.text }}>
                Prête à réviser&nbsp;?
              </div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 999,
              background: `linear-gradient(135deg, ${T.cobaltSoft}, ${T.goldSoft})`,
              border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: T.cobalt,
            }}>YE</div>
          </div>
        </div>

        {/* Streak hero card */}
        <div style={{ padding: '0 16px' }}>
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: `linear-gradient(140deg, ${T.cobalt} 0%, ${T.cobaltDeep} 100%)`,
            borderRadius: 22, padding: '18px 20px',
            color: '#fff',
            boxShadow: '0 12px 28px rgba(27,79,216,0.30)',
          }}>
            {/* zellige watermark */}
            <div style={{
              position: 'absolute', right: -30, top: -30, width: 200, height: 200,
              backgroundImage: zelligeTile({ fg: '#ffffff', size: 32, opacity: 0.6 }),
              opacity: 0.18, pointerEvents: 'none',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, opacity: 0.85, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                  <Icon name="flame" size={14} color="#fff" /> Série d'étude
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1 }}>12</span>
                  <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.85 }}>jours</span>
                </div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>+3 vs. semaine dernière</div>
              </div>
              {/* week dots */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                {['L','M','M','J','V','S','D'].map((d, i) => {
                  const done = i <= 5;
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 999,
                        background: done ? '#fff' : 'rgba(255,255,255,0.2)',
                        border: i === 5 ? `2px solid ${T.gold}` : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {done && <Icon name="check" size={11} color={T.cobaltDeep} strokeWidth={3} />}
                      </div>
                      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}>{d}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { v: '47', l: 'Notes',     c: T.cobalt },
            { v: '312', l: 'Cartes',    c: T.terracotta },
            { v: '89%', l: 'Précision', c: '#1F8A5B' },
          ].map((s, i) => (
            <div key={i} style={{
              background: T.surface, borderRadius: 16, padding: '12px 12px',
              boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c, letterSpacing: -0.5 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Flashcards due today */}
        <SectionHeader title="À réviser aujourd'hui" action="Tout voir" />
        <div style={{ padding: '0 16px' }}>
          <div style={{
            background: T.surface, borderRadius: 18, padding: 14,
            boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
            position: 'relative', overflow: 'hidden',
          }}>
            {/* gold corner ribbon — zellige sliver */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, ${T.gold} 0%, ${T.saffron} 50%, ${T.terracotta} 100%)`,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: `linear-gradient(140deg, ${T.saffronSoft}, ${T.goldSoft})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <Icon name="cards" size={24} color={T.saffron} />
                <div style={{
                  position: 'absolute', top: -4, right: -4,
                  background: T.terracotta, color: '#fff',
                  fontSize: 10, fontWeight: 700,
                  width: 20, height: 20, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff',
                }}>24</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>24 cartes à réviser</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>≈ 8 min · répétition espacée</div>
              </div>
              <button onClick={() => onTab?.('study')} style={{
                background: T.cobalt, color: '#fff', border: 0,
                padding: '9px 14px', borderRadius: 999,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                fontFamily: T.font, letterSpacing: 0.1,
                boxShadow: '0 4px 10px rgba(27,79,216,0.25)',
              }}>Démarrer</button>
            </div>
            {/* progress */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 5, borderRadius: 999, background: T.borderSoft, overflow: 'hidden' }}>
                <div style={{ width: '35%', height: '100%', background: `linear-gradient(90deg, ${T.cobalt}, ${T.saffron})` }} />
              </div>
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>8/24</span>
            </div>
          </div>
        </div>

        {/* Recent notes */}
        <SectionHeader title="Notes récentes" action="Voir tout" />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {RECENT_NOTES.map(n => (
            <button key={n.id} onClick={() => onOpenNote?.(n.id)} style={{
              all: 'unset', cursor: 'pointer',
              background: T.surface, borderRadius: 16, padding: 12,
              boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
              display: 'flex', alignItems: 'center', gap: 12,
              borderLeft: `3px solid ${T.subj[n.subject].fg}`,
              fontFamily: T.font,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: T.subj[n.subject].soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: zelligeTile({ fg: T.subj[n.subject].fg, size: 18, opacity: 0.45 }), opacity: 0.5 }} />
                <span style={{ fontSize: 18, fontWeight: 800, color: T.subj[n.subject].fg, position: 'relative' }}>{n.glyph}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <SubjectPill subject={n.subject} />
                  <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 500 }}>{n.time}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="doc" size={11} /> {n.pages} p.</span>
                  <span style={{ width: 2, height: 2, borderRadius: 999, background: T.textFaint }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="cards" size={11} /> {n.cards} cartes</span>
                </div>
              </div>
              <Icon name="chevron" size={16} color={T.textFaint} />
            </button>
          ))}
        </div>

        {/* Capture prompt */}
        <div style={{ padding: '18px 16px 0' }}>
          <button onClick={onOpenCapture} style={{
            all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box',
            background: T.surface, border: `1.5px dashed ${T.border}`, borderRadius: 18,
            padding: '14px 16px', textAlign: 'center', color: T.textMuted,
            fontFamily: T.font,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="camera" size={16} color={T.cobalt} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Capturer de nouvelles notes</span>
            </div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Photo, PDF ou import depuis la galerie</div>
          </button>
        </div>

        <div style={{ height: 20 }} />
      </ScrollBody>

      <BottomNav active="home" onChange={onTab} onCapture={onOpenCapture} />
    </Phone>
  );
}

function SectionHeader({ title, action }) {
  return (
    <div style={{ padding: '20px 20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>{title}</h2>
      {action && <button style={{
        all: 'unset', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, color: T.cobalt,
        display: 'flex', alignItems: 'center', gap: 2,
        fontFamily: T.font,
      }}>{action} <Icon name="chevron" size={12} /></button>}
    </div>
  );
}

const RECENT_NOTES = [
  { id: 'n1', subject: 'Math',    glyph: '∫', title: 'Intégrales par parties', time: 'il y a 2h',  pages: 4, cards: 18 },
  { id: 'n2', subject: 'Physics', glyph: 'φ', title: 'Mécanique quantique — ondes', time: 'hier', pages: 6, cards: 24 },
  { id: 'n3', subject: 'CS',      glyph: '{', title: 'Algorithmes de graphes (BFS/DFS)', time: 'hier', pages: 3, cards: 12 },
  { id: 'n4', subject: 'Biology', glyph: '⌬', title: 'Cycle de Krebs', time: '2 jours',          pages: 5, cards: 20 },
];

Object.assign(window, { HomeScreen, RECENT_NOTES });
