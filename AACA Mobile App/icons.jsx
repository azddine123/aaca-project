// Lightweight icon set — outlined, 24px, 1.7 stroke. Single component.
function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.7, style = {} }) {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>;
    case 'notes':
      return <svg {...props}><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
    case 'study':
      return <svg {...props}><path d="M2 7l10-4 10 4-10 4z"/><path d="M6 9.5V14c0 1.5 3 3 6 3s6-1.5 6-3V9.5"/><path d="M22 7v6"/></svg>;
    case 'profile':
      return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>;
    case 'camera':
      return <svg {...props}><path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'flame':
      return <svg {...props}><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-3-2 1-4 4-4 7a7 7 0 0 0 14 0c0-5-4-9-7-12z"/></svg>;
    case 'cards':
      return <svg {...props}><rect x="3" y="6" width="14" height="14" rx="2"/><rect x="7" y="3" width="14" height="14" rx="2"/></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
    case 'check':
      return <svg {...props}><path d="M4 12l5 5L20 6"/></svg>;
    case 'chevron':
      return <svg {...props}><path d="M9 6l6 6-6 6"/></svg>;
    case 'chevron-left':
      return <svg {...props}><path d="M15 6l-6 6 6 6"/></svg>;
    case 'plus':
      return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.5-4.5"/></svg>;
    case 'filter':
      return <svg {...props}><path d="M3 5h18M6 12h12M10 19h4"/></svg>;
    case 'grid':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case 'list':
      return <svg {...props}><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="0.8" fill={color}/><circle cx="4" cy="12" r="0.8" fill={color}/><circle cx="4" cy="18" r="0.8" fill={color}/></svg>;
    case 'sparkle':
      return <svg {...props}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>;
    case 'doc':
      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>;
    case 'pdf':
      return <svg {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><text x="8" y="17" fontSize="5" fontWeight="700" fill={color} stroke="none">PDF</text></svg>;
    case 'image':
      return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/></svg>;
    case 'flash':
      return <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>;
    case 'flash-off':
      return <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z" opacity="0.4"/><path d="M3 3l18 18"/></svg>;
    case 'rotate':
      return <svg {...props}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>;
    case 'gallery':
      return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="8" cy="9" r="1.5"/></svg>;
    case 'upload':
      return <svg {...props}><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>;
    case 'play':
      return <svg {...props}><path d="M6 4l14 8L6 20z" fill={color}/></svg>;
    case 'shuffle':
      return <svg {...props}><path d="M16 3h5v5M21 3l-7 7M4 4l16 16M21 16v5h-5M21 21l-5-5"/></svg>;
    case 'x':
      return <svg {...props}><path d="M6 6l12 12M18 6L6 18"/></svg>;
    case 'bookmark':
      return <svg {...props}><path d="M6 3h12v18l-6-4-6 4z"/></svg>;
    case 'globe':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
    case 'arrow-right':
      return <svg {...props}><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
    case 'mic':
      return <svg {...props}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;
    case 'lightning':
      return <svg {...props}><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>;
    case 'trending':
      return <svg {...props}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case 'crop':
      return <svg {...props}><path d="M6 2v16h16"/><path d="M2 6h16v16"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="9"/></svg>;
  }
}

window.Icon = Icon;
