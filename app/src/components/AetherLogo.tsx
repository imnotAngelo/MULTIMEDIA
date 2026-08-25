import { Sparkles } from 'lucide-react';

interface AetherLogoProps {
  compact?: boolean;
}

export function AetherLogo({ compact = false }: AetherLogoProps) {
  return (
    <div className={`aether-logo ${compact ? 'aether-logo--compact' : ''}`} aria-label="Multimedia Learning">
      <span className="aether-logo__orbit aether-logo__orbit--one" />
      <span className="aether-logo__orbit aether-logo__orbit--two" />
      <span className="aether-logo__core">
        <Sparkles className="aether-logo__spark" aria-hidden="true" />
        <span className="aether-logo__letter">M</span>
      </span>
    </div>
  );
}