import { useId } from 'react';

interface AetherLogoProps {
  compact?: boolean;
}

export function AetherLogo({ compact = false }: AetherLogoProps) {
  const id = useId().replace(/:/g, '');
  const frameGradient = `frameGrad-${id}`;
  const imageGradient = `imgGrad-${id}`;
  const videoGradient = `vidGrad-${id}`;
  const playGradient = `playGrad-${id}`;
  const personGradient = `personGrad-${id}`;
  const orbGradient = `orbGrad-${id}`;
  const textGradient = `textGrad-${id}`;
  const softFilter = `soft-${id}`;

  return (
    <div className={`aether-logo ${compact ? 'aether-logo--compact' : ''}`} aria-label="Interactive Learning">
      <svg viewBox={compact ? '40 80 650 430' : '0 0 720 720'} role="img" aria-labelledby={`logo-title-${id}`}>
        <title id={`logo-title-${id}`}>Interactive Learning</title>
        <defs>
          <linearGradient id={frameGradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#22d3ee" /><stop offset="40%" stopColor="#3b82f6" /><stop offset="72%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#fb923c" /></linearGradient>
          <linearGradient id={imageGradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#155eaa" /></linearGradient>
          <linearGradient id={videoGradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#5b3df0" /><stop offset="100%" stopColor="#7b2ff7" /></linearGradient>
          <linearGradient id={playGradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#ef4d7a" /><stop offset="100%" stopColor="#7b2ff7" /></linearGradient>
          <linearGradient id={personGradient} x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#3b4fd9" /></linearGradient>
          <linearGradient id={orbGradient} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#fb923c" /><stop offset="100%" stopColor="#ef4d7a" /></linearGradient>
          <linearGradient id={textGradient} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#38bdf8" /><stop offset="45%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#ef4d7a" /></linearGradient>
          <filter id={softFilter} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity=".35" /></filter>
        </defs>
        <g className="aether-logo__bloom">
          <rect className="aether-logo__bloom-piece aether-logo__drift" x="570" y="96" width="22" height="22" rx="6" fill="#1e88f2" />
          <rect className="aether-logo__bloom-piece" x="606" y="104" width="14" height="14" rx="4" fill="#39c8ec" />
          <rect className="aether-logo__bloom-piece aether-logo__drift" x="556" y="130" width="26" height="26" rx="7" fill="#3b4fd9" />
          <rect className="aether-logo__bloom-piece" x="594" y="132" width="20" height="20" rx="6" fill="#1e88f2" />
          <rect className="aether-logo__bloom-piece aether-logo__drift" x="628" y="126" width="24" height="24" rx="7" fill="#d946ef" />
          <rect className="aether-logo__bloom-piece" x="580" y="166" width="16" height="16" rx="5" fill="#3d4dd6" />
          <rect className="aether-logo__bloom-piece aether-logo__drift" x="610" y="168" width="30" height="30" rx="8" fill="#7b2ff7" />
          <rect className="aether-logo__bloom-piece" x="644" y="170" width="26" height="26" rx="7" fill="#fb923c" />
          <rect className="aether-logo__bloom-piece aether-logo__drift" x="592" y="204" width="12" height="12" rx="4" fill="#4653e0" />
        </g>
        <path className="aether-logo__frame" pathLength="1900" d="M620,200 L620,500 Q620,540 580,540 L180,540 Q140,540 140,500 L140,170 Q140,130 180,130 L580,130" stroke={`url(#${frameGradient})`} />
        <g className="aether-logo__pop aether-logo__image" filter={`url(#${softFilter})`}>
          <rect x="58" y="148" width="222" height="146" rx="20" fill="#0e1530" stroke={`url(#${imageGradient})`} strokeWidth="7" /><circle cx="106" cy="200" r="15" fill={`url(#${imageGradient})`} /><path d="M78,272 L150,210 L188,246 L226,196 L260,272 Z" fill={`url(#${imageGradient})`} opacity=".92" />
        </g>
        <g className="aether-logo__pop aether-logo__video-icon" filter={`url(#${softFilter})`}>
          <rect x="58" y="312" width="168" height="92" rx="18" fill={`url(#${videoGradient})`} /><path d="M96,336 L96,380 L136,358 Z" fill="#fff" /><rect x="160" y="332" width="8" height="10" rx="2" fill="#fff" opacity=".85" /><rect x="160" y="352" width="8" height="10" rx="2" fill="#fff" opacity=".85" /><rect x="160" y="372" width="8" height="10" rx="2" fill="#fff" opacity=".85" />
        </g>
        <g className="aether-logo__pop aether-logo__play" filter={`url(#${softFilter})`}><path d="M304,168 Q296,168 296,178 L296,336 Q296,346 305,341 L452,264 Q460,259 452,254 L305,173 Q304,168 304,168 Z" fill={`url(#${playGradient})`} /><path d="M334,206 L334,306 L416,256 Z" fill="#fff" opacity=".95" /></g>
        <g className="aether-logo__pop aether-logo__book" filter={`url(#${softFilter})`}><path d="M150,462 Q230,438 300,458 L300,486 Q230,468 150,488 Z" fill="#dfe6ff" /><path d="M300,458 Q370,438 450,462 L450,488 Q370,468 300,486 Z" fill="#c9d3fb" /></g>
        <g className="aether-logo__pop aether-logo__person"><circle cx="600" cy="258" r="26" fill={`url(#${personGradient})`} /><path d="M560,480 Q556,360 574,320 Q560,286 596,262 Q636,260 632,300 Q650,340 640,480 Z" fill={`url(#${personGradient})`} /></g>
        <circle className="aether-logo__pop aether-logo__orb" cx="600" cy="196" r="20" fill={`url(#${orbGradient})`} filter={`url(#${softFilter})`} />
        <g className="aether-logo__wordmark">
          <text x="360" y="606" textAnchor="middle" className="aether-logo__eyebrow">INTERACTIVE</text>
          <text x="360" y="660" textAnchor="middle" className="aether-logo__main" fill={`url(#${textGradient})`}>LEARNING</text>
          <text x="360" y="686" textAnchor="middle" className="aether-logo__sub">FOR FUNDAMENTALS OF MULTIMEDIA SYSTEM</text>
          <rect className="aether-logo__underline" x="230" y="700" width="260" height="3" rx="1.5" fill={`url(#${textGradient})`} />
        </g>
      </svg>
    </div>
  );
}