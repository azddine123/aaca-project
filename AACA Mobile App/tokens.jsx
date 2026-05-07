// AACA design tokens — Moroccan academic, light & airy
const T = {
  // surface
  bg: '#F0F2F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',

  // text
  text: '#1C1E21',
  textMuted: '#65676B',
  textFaint: '#8A8D91',

  // hairline
  border: '#E4E6EB',
  borderSoft: '#EEF0F3',

  // brand
  cobalt: '#1B4FD8',
  cobaltDeep: '#143FAE',
  cobaltSoft: '#E8EEFC',

  // moroccan accents
  terracotta: '#C1440E',
  terracottaSoft: '#FBE9E0',
  gold: '#D4A017',
  goldSoft: '#FAF1D9',
  saffron: '#F59E0B',
  saffronSoft: '#FEF1D6',

  // subjects (per brief)
  subj: {
    Math:     { fg: '#1B4FD8', soft: '#E8EEFC' },
    Physics:  { fg: '#C1440E', soft: '#FBE9E0' },
    Biology:  { fg: '#1F8A5B', soft: '#E2F1EA' },
    CS:       { fg: '#F59E0B', soft: '#FEF1D6' },
    Chimie:   { fg: '#7C3AED', soft: '#EFE7FB' },
    Histoire: { fg: '#D4A017', soft: '#FAF1D9' },
  },

  font: '"Plus Jakarta Sans", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',

  // shadows
  card: '0 1px 2px rgba(20,30,60,0.04), 0 4px 14px rgba(20,30,60,0.06)',
  cardHover: '0 2px 4px rgba(20,30,60,0.06), 0 12px 28px rgba(20,30,60,0.10)',
  pop: '0 20px 50px rgba(15,30,80,0.18)',
};

// Zellige tile — 8-point Moroccan star, repeatable.
// Returns a data URL so it can be used as background-image directly.
function zelligeTile({ fg = '#1B4FD8', bg = 'transparent', size = 28, opacity = 1 } = {}) {
  // 8-point star formed by two overlapping squares
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 28 28">
    <rect width="28" height="28" fill="${bg}"/>
    <g fill="none" stroke="${fg}" stroke-width="0.9" opacity="${opacity}" stroke-linejoin="round">
      <rect x="6" y="6" width="16" height="16"/>
      <rect x="6" y="6" width="16" height="16" transform="rotate(45 14 14)"/>
      <circle cx="14" cy="14" r="2.2"/>
    </g>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

// Decorative band — horizontal zellige strip, full-width
function ZelligeBand({ color = T.gold, opacity = 0.55, height = 14, style = {} }) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='56' height='14' viewBox='0 0 56 14'>
    <g fill='none' stroke='${color}' stroke-width='1' opacity='${opacity}' stroke-linejoin='round'>
      <path d='M0 7 L7 0 L14 7 L7 14 Z'/>
      <path d='M14 7 L21 0 L28 7 L21 14 Z'/>
      <path d='M28 7 L35 0 L42 7 L35 14 Z'/>
      <path d='M42 7 L49 0 L56 7 L49 14 Z'/>
      <circle cx='7' cy='7' r='1.5'/>
      <circle cx='21' cy='7' r='1.5'/>
      <circle cx='35' cy='7' r='1.5'/>
      <circle cx='49' cy='7' r='1.5'/>
    </g>
  </svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <div style={{
      height, width: '100%',
      backgroundImage: url, backgroundRepeat: 'repeat-x',
      backgroundSize: '56px 14px', backgroundPosition: 'center',
      ...style,
    }} />
  );
}

// Moroccan horseshoe-arch top — used as a header silhouette/clip
// Returns a clip-path string that produces the arch shape.
const ARCH_CLIP = 'path("M 0 100 L 0 60 Q 0 0 50 0 Q 100 0 100 60 L 100 100 Z")';

// Arabesque ornament — 8-point rosette (used as watermark on empty states)
function ArabesqueOrnament({ size = 200, color = T.gold, opacity = 0.12, style = {} }) {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='${size}' height='${size}'>
    <g fill='none' stroke='${color}' stroke-width='1.2' opacity='${opacity}'>
      <circle cx='100' cy='100' r='80'/>
      <circle cx='100' cy='100' r='55'/>
      <circle cx='100' cy='100' r='30'/>
      ${Array.from({length: 8}).map((_,i)=>{
        const a = (i*45) * Math.PI/180;
        const x1 = 100 + Math.cos(a)*30, y1 = 100 + Math.sin(a)*30;
        const x2 = 100 + Math.cos(a)*80, y2 = 100 + Math.sin(a)*80;
        return `<line x1='${x1}' y1='${y1}' x2='${x2}' y2='${y2}'/>`;
      }).join('')}
      ${Array.from({length: 16}).map((_,i)=>{
        const a = (i*22.5) * Math.PI/180;
        const x = 100 + Math.cos(a)*55, y = 100 + Math.sin(a)*55;
        return `<circle cx='${x}' cy='${y}' r='3'/>`;
      }).join('')}
      <path d='M100 20 L115 50 L150 50 L122 70 L132 100 L100 82 L68 100 L78 70 L50 50 L85 50 Z' transform='rotate(0 100 100)'/>
      <path d='M100 20 L115 50 L150 50 L122 70 L132 100 L100 82 L68 100 L78 70 L50 50 L85 50 Z' transform='rotate(45 100 100)'/>
    </g>
  </svg>`;
  return (
    <div style={{
      width: size, height: size,
      backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(s)}")`,
      backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
      ...style,
    }} />
  );
}

// Subject pill
function SubjectPill({ subject, size = 'sm' }) {
  const c = T.subj[subject] || T.subj.Math;
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: small ? '3px 8px' : '5px 10px',
      background: c.soft, color: c.fg,
      borderRadius: 999,
      fontSize: small ? 11 : 12, fontWeight: 600,
      letterSpacing: 0.1,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: 999, background: c.fg,
      }} />
      {subject}
    </span>
  );
}

// Gold divider — thin gold line with optional zellige diamond center
function GoldDivider({ ornament = true, style = {} }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...style }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold}88, transparent)` }} />
      {ornament && (
        <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
          <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="none" stroke={T.gold} strokeWidth="1" />
          <circle cx="7" cy="7" r="1.5" fill={T.gold} />
        </svg>
      )}
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold}88, transparent)` }} />
    </div>
  );
}

Object.assign(window, { T, zelligeTile, ZelligeBand, ARCH_CLIP, ArabesqueOrnament, SubjectPill, GoldDivider });
