import { Loader2, Sparkles } from 'lucide-react';

interface AetherLoaderProps {
  label?: string;
  compact?: boolean;
}

export function AetherLoader({ label = 'Loading your learning space', compact = false }: AetherLoaderProps) {
  return (
    <div className={`aether-loader ${compact ? 'aether-loader--compact' : ''}`} role="status" aria-live="polite">
      <div className="aether-loader__visual" aria-hidden="true">
        <span className="aether-loader__ring aether-loader__ring--outer" />
        <span className="aether-loader__ring aether-loader__ring--inner" />
        <span className="aether-loader__core"><Sparkles /></span>
        <span className="aether-loader__beam" />
      </div>
      <div className="aether-loader__copy">
        <span>{label}</span>
        <div className="aether-loader__bars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      </div>
      <Loader2 className="aether-loader__fallback" aria-hidden="true" />
    </div>
  );
}