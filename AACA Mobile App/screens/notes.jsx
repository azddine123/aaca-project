// Notes list — grid of subject cards with colored left border
function NotesScreen({ onOpenNote, onTab, onOpenCapture }) {
  const [view, setView] = React.useState('grid');
  const [filter, setFilter] = React.useState('Tous');
  const subjects = ['Tous', 'Math', 'Physics', 'Biology', 'CS', 'Chimie'];
  const filtered = filter === 'Tous' ? ALL_NOTES : ALL_NOTES.filter(n => n.subject === filter);

  return (
    <Phone>
      <ScrollBody>
        <div style={{ padding: '4px 20px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.7, color: T.text }}>Mes notes</h1>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setView(view === 'grid' ? 'list' : 'grid')} style={iconBtn}>
                <Icon name={view === 'grid' ? 'list' : 'grid'} size={18} color={T.text} />
              </button>
              <button style={iconBtn}>
                <Icon name="search" size={18} color={T.text} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{ALL_NOTES.length} notes · 312 cartes</div>
        </div>

        {/* Filter chips */}
        <div style={{ padding: '8px 0 12px' }}>
          <div style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {subjects.map(s => {
              const active = filter === s;
              const c = T.subj[s];
              return (
                <button key={s} onClick={() => setFilter(s)} style={{
                  flexShrink: 0, all: 'unset', cursor: 'pointer',
                  padding: '7px 13px', borderRadius: 999,
                  fontSize: 12, fontWeight: 700, fontFamily: T.font,
                  background: active ? (c?.fg || T.text) : T.surface,
                  color: active ? '#fff' : T.text,
                  border: `1px solid ${active ? 'transparent' : T.border}`,
                  boxShadow: active ? '0 4px 10px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {s !== 'Tous' && <span style={{ width: 6, height: 6, borderRadius: 999, background: active ? '#fff' : c.fg }} />}
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        {view === 'grid' ? (
          <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {filtered.map(n => <NoteCard key={n.id} n={n} onClick={() => onOpenNote?.(n.id)} />)}
          </div>
        ) : (
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => <NoteRow key={n.id} n={n} onClick={() => onOpenNote?.(n.id)} />)}
          </div>
        )}

        <div style={{ height: 20 }} />
      </ScrollBody>

      <BottomNav active="notes" onChange={onTab} onCapture={onOpenCapture} />
    </Phone>
  );
}

const iconBtn = {
  all: 'unset', cursor: 'pointer',
  width: 36, height: 36, borderRadius: 12,
  background: T.surface, border: `1px solid ${T.borderSoft}`,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

function NoteCard({ n, onClick }) {
  const c = T.subj[n.subject];
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer',
      background: T.surface, borderRadius: 16,
      boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      borderLeft: `3px solid ${c.fg}`,
      padding: 12, fontFamily: T.font,
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden',
      minHeight: 150,
    }}>
      {/* zellige header strip */}
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 70, height: 50,
        backgroundImage: zelligeTile({ fg: c.fg, size: 22, opacity: 0.55 }),
        opacity: 0.18, pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <SubjectPill subject={n.subject} />
        {n.bookmark && <Icon name="bookmark" size={14} color={T.gold} />}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700, color: T.text, lineHeight: 1.3,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{n.title}</div>
      <div style={{ flex: 1 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="doc" size={11} /> {n.pages} p.
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="cards" size={11} /> {n.cards}
        </span>
      </div>
      {/* subtle progress indicator */}
      <div style={{ height: 3, borderRadius: 999, background: T.borderSoft, overflow: 'hidden' }}>
        <div style={{ width: `${n.progress}%`, height: '100%', background: c.fg }} />
      </div>
    </button>
  );
}

function NoteRow({ n, onClick }) {
  const c = T.subj[n.subject];
  return (
    <button onClick={onClick} style={{
      all: 'unset', cursor: 'pointer',
      background: T.surface, borderRadius: 14,
      boxShadow: T.card, border: `1px solid ${T.borderSoft}`,
      borderLeft: `3px solid ${c.fg}`,
      padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
      fontFamily: T.font,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, background: c.soft,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 800, color: c.fg, flexShrink: 0,
      }}>{n.glyph}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>{n.subject} · {n.pages} p · {n.cards} cartes</div>
      </div>
      <Icon name="chevron" size={14} color={T.textFaint} />
    </button>
  );
}

const ALL_NOTES = [
  { id: 'n1', subject: 'Math',    glyph: '∫', title: 'Intégrales par parties', pages: 4, cards: 18, progress: 75, bookmark: true },
  { id: 'n2', subject: 'Physics', glyph: 'φ', title: 'Mécanique quantique — fonctions d\'onde', pages: 6, cards: 24, progress: 40 },
  { id: 'n3', subject: 'CS',      glyph: '{', title: 'Algorithmes de graphes BFS / DFS', pages: 3, cards: 12, progress: 90 },
  { id: 'n4', subject: 'Biology', glyph: '⌬', title: 'Cycle de Krebs et respiration cellulaire', pages: 5, cards: 20, progress: 60, bookmark: true },
  { id: 'n5', subject: 'Math',    glyph: 'Σ', title: 'Séries et suites convergentes', pages: 4, cards: 16, progress: 30 },
  { id: 'n6', subject: 'Chimie',  glyph: '⚗', title: 'Liaisons covalentes et hybridation', pages: 3, cards: 14, progress: 55 },
  { id: 'n7', subject: 'Physics', glyph: '⚛', title: 'Lois de Newton — exercices', pages: 2, cards: 10, progress: 100 },
  { id: 'n8', subject: 'CS',      glyph: 'λ', title: 'Programmation fonctionnelle', pages: 4, cards: 15, progress: 20 },
];

Object.assign(window, { NotesScreen, ALL_NOTES });
