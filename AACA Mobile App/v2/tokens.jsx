// AACA v2 — authentic Moroccan tokens, rich zellige

const T2 = {
  // surface
  bg: '#FDF6EC',           // warm sand white
  bgWarm: '#F8EFDD',
  surface: '#FFFFFF',
  surfaceAlt: '#FBF3E2',

  // text
  text: '#1A1A1A',
  textMuted: '#6B5B47',     // warm muted (not cool grey)
  textFaint: '#A89380',

  // hairline
  border: '#EDE0C8',
  borderSoft: '#F4EAD5',

  // brand — Moroccan
  blue: '#0A3D8F',          // royal zellige blue
  blueDeep: '#062868',
  blueSoft: '#E1E8F4',

  terracotta: '#B5451B',
  terracottaDeep: '#8C3210',
  terracottaSoft: '#F8E0D0',

  saffron: '#E8A020',
  saffronDeep: '#B57A0E',
  saffronSoft: '#FCEFCE',

  green: '#1B5E3B',
  greenDeep: '#0F4528',
  greenSoft: '#D8E8DD',

  // subjects — recolored to authentic palette
  subj: {
    Math:     { fg: '#0A3D8F', soft: '#E1E8F4', name: 'Maths' },
    Physics:  { fg: '#B5451B', soft: '#F8E0D0', name: 'Physique' },
    Biology:  { fg: '#1B5E3B', soft: '#D8E8DD', name: 'Biologie' },
    CS:       { fg: '#E8A020', soft: '#FCEFCE', name: 'Informatique' },
    Chimie:   { fg: '#7C3AED', soft: '#EDE3FB', name: 'Chimie' },
    Histoire: { fg: '#8C3210', soft: '#F4DCC9', name: 'Histoire' },
  },

  font: '"Plus Jakarta Sans", "Inter", -apple-system, system-ui, sans-serif',
  fontDisplay: '"Plus Jakarta Sans", -apple-system, system-ui, sans-serif',
  fontMono: '"JetBrains Mono", ui-monospace, monospace',
  fontArabic: '"Amiri", "Noto Naskh Arabic", "Plus Jakarta Sans", serif',

  // warm shadows (not cool grey/blue)
  card: '0 1px 2px rgba(120,80,30,0.04), 0 6px 18px rgba(120,80,30,0.08)',
  cardLg: '0 4px 8px rgba(120,80,30,0.06), 0 18px 36px rgba(120,80,30,0.12)',
  cardWarm: '0 2px 4px rgba(181,69,27,0.06), 0 10px 24px rgba(181,69,27,0.10)',
};

// ─────────────────────────────────────────────────────────────
// AUTHENTIC ZELLIGE — 8-point star + interlocking pattern
// ─────────────────────────────────────────────────────────────

// Returns a tileable SVG of the classic 8-point star (khatem) pattern
// surrounded by 4 diamond crosses — the most recognizable Moroccan zellige
// tile.  size is the unit cell width; tile actually tiles 2x2 cells per
// repeat for proper interlocking.
function zelligeStar({ fg = '#0A3D8F', bg = '#FDF6EC', size = 60, accent = '#E8A020', stroke = 0.8 } = {}) {
  // 8-point star points (centered at 30,30)
  const c = 30, R = 22, r = 9;
  let starPath = '';
  for (let i = 0; i < 16; i++) {
    const ang = (i * Math.PI) / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = c + Math.cos(ang) * rad;
    const y = c + Math.sin(ang) * rad;
    starPath += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  starPath += 'Z';

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 60 60'>
    <rect width='60' height='60' fill='${bg}'/>
    <!-- center 8-point star -->
    <path d='${starPath}' fill='${fg}' stroke='${accent}' stroke-width='${stroke}' stroke-linejoin='round'/>
    <!-- corner star fragments (repeats interlock) -->
    <path d='M0 0 L9 0 L0 9 Z' fill='${fg}'/>
    <path d='M60 0 L51 0 L60 9 Z' fill='${fg}'/>
    <path d='M0 60 L9 60 L0 51 Z' fill='${fg}'/>
    <path d='M60 60 L51 60 L60 51 Z' fill='${fg}'/>
    <!-- side diamond crosses (cross shapes between stars) -->
    <path d='M30 0 L36 6 L30 12 L24 6 Z' fill='${accent}' opacity='0.85'/>
    <path d='M30 60 L36 54 L30 48 L24 54 Z' fill='${accent}' opacity='0.85'/>
    <path d='M0 30 L6 36 L12 30 L6 24 Z' fill='${accent}' opacity='0.85'/>
    <path d='M60 30 L54 36 L48 30 L54 24 Z' fill='${accent}' opacity='0.85'/>
    <!-- inner ring -->
    <circle cx='30' cy='30' r='3.5' fill='${bg}'/>
    <circle cx='30' cy='30' r='1.4' fill='${accent}'/>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

// Larger, denser 4-color zellige for hero backgrounds (multi-color per cell)
function zelligeRich({ size = 120, opacity = 1 } = {}) {
  const blue = T2.blue, terra = T2.terracotta, gold = T2.saffron, green = T2.green, sand = T2.bg;
  // 8-point star centered at 60,60
  const c = 60, R = 44, r = 18;
  let starPath = '';
  for (let i = 0; i < 16; i++) {
    const ang = (i * Math.PI) / 8 - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    const x = c + Math.cos(ang) * rad;
    const y = c + Math.sin(ang) * rad;
    starPath += (i === 0 ? 'M' : 'L') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  starPath += 'Z';

  // 4 corner crosses (diamond shapes that fill gaps between adjacent stars)
  // Each is a 4-pointed cross at corners.
  const cross = (cx, cy, color) =>
    `<path d='M${cx} ${cy-12} L${cx+12} ${cy} L${cx} ${cy+12} L${cx-12} ${cy} Z' fill='${color}'/>` +
    `<path d='M${cx-3} ${cy-3} L${cx+3} ${cy-3} L${cx+3} ${cy+3} L${cx-3} ${cy+3} Z' fill='${sand}'/>`;

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 120 120' opacity='${opacity}'>
    <rect width='120' height='120' fill='${sand}'/>
    <path d='${starPath}' fill='${blue}'/>
    <!-- inner medallion -->
    <path d='M${c} ${c-14} L${c+14} ${c} L${c} ${c+14} L${c-14} ${c} Z' fill='${gold}'/>
    <circle cx='${c}' cy='${c}' r='6' fill='${terra}'/>
    <circle cx='${c}' cy='${c}' r='2.5' fill='${sand}'/>
    <!-- 4 corner crosses interlock with adjacent tile stars -->
    ${cross(0, 0, terra)}
    ${cross(120, 0, terra)}
    ${cross(0, 120, terra)}
    ${cross(120, 120, terra)}
    <!-- side diamonds (small) -->
    <path d='M60 0 L66 6 L60 12 L54 6 Z' fill='${green}'/>
    <path d='M60 120 L66 114 L60 108 L54 114 Z' fill='${green}'/>
    <path d='M0 60 L6 66 L12 60 L6 54 Z' fill='${green}'/>
    <path d='M120 60 L114 66 L108 60 L114 54 Z' fill='${green}'/>
  </svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

// Decorative zellige BORDER STRIP — thick band, 8-cell repeating pattern,
// designed to sit at the top of cards / bottom of nav.
function ZelligeBorder({ height = 14, color = T2.blue, accent = T2.saffron, bg = 'transparent', style = {} }) {
  const w = 56;
  // 8-cell repeat: 4 stars + 4 cross-diamonds, alternating
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='14' viewBox='0 0 56 14' preserveAspectRatio='xMidYMid slice'>
    <rect width='56' height='14' fill='${bg}'/>
    <!-- 4 mini 8-point stars -->
    ${[3.5, 17.5, 31.5, 45.5].map(cx => {
      let p = '';
      for (let i = 0; i < 16; i++) {
        const ang = (i * Math.PI) / 8 - Math.PI / 2;
        const rad = i % 2 === 0 ? 5 : 2.2;
        const x = cx + Math.cos(ang) * rad;
        const y = 7 + Math.sin(ang) * rad;
        p += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      return `<path d='${p}Z' fill='${color}'/>`;
    }).join('')}
    <!-- 4 diamonds between stars (saffron) -->
    ${[10.5, 24.5, 38.5, 52.5].map(cx => `<path d='M${cx} 3 L${cx+3} 7 L${cx} 11 L${cx-3} 7 Z' fill='${accent}'/>`).join('')}
    <!-- top + bottom hairlines -->
    <line x1='0' y1='0.5' x2='56' y2='0.5' stroke='${color}' stroke-width='0.5' opacity='0.4'/>
    <line x1='0' y1='13.5' x2='56' y2='13.5' stroke='${color}' stroke-width='0.5' opacity='0.4'/>
  </svg>`;
  const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  return (
    <div style={{
      height, width: '100%',
      backgroundImage: url, backgroundRepeat: 'repeat-x',
      backgroundSize: `${w}px ${height}px`, backgroundPosition: 'center',
      ...style,
    }} />
  );
}

// Moroccan horseshoe-arch SVG — used as full-width header silhouette
function MoroccanArch({ width = 390, height = 280, fillUrl, fill = T2.blue, gold = T2.saffron, children }) {
  // Horseshoe arch: rises from baseline, curves out (slightly past 90°),
  // then domes inward at the top — classic riad / mosque shape.
  // Outer rectangle wraps around the negative space (the arch is a CUTOUT).
  // Path describes the BLUE FILL with the arch as a hollow.
  const archD = `M 0 0 L ${width} 0 L ${width} ${height} L ${width*0.78} ${height} L ${width*0.78} ${height*0.55} C ${width*0.78} ${height*0.20} ${width*0.65} ${height*0.10} ${width*0.50} ${height*0.10} C ${width*0.35} ${height*0.10} ${width*0.22} ${height*0.20} ${width*0.22} ${height*0.55} L ${width*0.22} ${height} L 0 ${height} Z`;
  const archInner = `M ${width*0.22} ${height} L ${width*0.22} ${height*0.55} C ${width*0.22} ${height*0.20} ${width*0.35} ${height*0.10} ${width*0.50} ${height*0.10} C ${width*0.65} ${height*0.10} ${width*0.78} ${height*0.20} ${width*0.78} ${height*0.55} L ${width*0.78} ${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* The actual arch — solid coloured area surrounding the open horseshoe */}
      <path d={archD} fill={fillUrl ? `url(#${fillUrl})` : fill} />
      {/* gold inner trim — runs along the arch curve only */}
      <path d={archInner} fill="none" stroke={gold} strokeWidth="2.5" />
      <path d={`M ${width*0.245} ${height} L ${width*0.245} ${height*0.555} C ${width*0.245} ${height*0.215} ${width*0.36} ${height*0.115} ${width*0.50} ${height*0.115} C ${width*0.64} ${height*0.115} ${width*0.755} ${height*0.215} ${width*0.755} ${height*0.555} L ${width*0.755} ${height}`}
        fill="none" stroke={gold} strokeWidth="0.8" opacity="0.6" />
      {/* keystone diamond at the apex */}
      <g transform={`translate(${width*0.5} ${height*0.10})`}>
        <path d="M0 -10 L10 0 L0 10 L-10 0 Z" fill={gold} />
        <circle cx="0" cy="0" r="2.5" fill={fill} />
      </g>
      {children}
    </svg>
  );
}

// Section header — full zellige tile background, French + Arabic
function SectionHeader2({ fr, ar, action, color = T2.blue, height = 64 }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 16,
      background: T2.bg,
      margin: '0 20px',
      border: `1px solid ${T2.border}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: zelligeStar({ fg: color, bg: T2.bg, size: 64, accent: T2.saffron, stroke: 0 }),
        opacity: 0.18,
      }} />
      <div style={{
        position: 'relative', padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T2.text, letterSpacing: -0.4 }}>{fr}</div>
          {ar && <div style={{ fontSize: 12, color: T2.textMuted, fontWeight: 600, fontFamily: T2.fontArabic, direction: 'rtl', marginTop: 1 }}>{ar}</div>}
        </div>
        {action}
      </div>
    </div>
  );
}

// Subject pill v2
function SubjectPill2({ subject, size = 'sm' }) {
  const c = T2.subj[subject] || T2.subj.Math;
  const small = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '4px 10px' : '6px 12px',
      background: c.soft, color: c.fg,
      borderRadius: 999,
      fontSize: small ? 11 : 13, fontWeight: 700,
      letterSpacing: 0.1, fontFamily: T2.font,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 999, background: c.fg }} />
      {c.name}
    </span>
  );
}

Object.assign(window, {
  T2, zelligeStar, zelligeRich, ZelligeBorder, MoroccanArch, SectionHeader2, SubjectPill2,
});
