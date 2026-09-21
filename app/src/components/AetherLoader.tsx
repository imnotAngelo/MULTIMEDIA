interface AetherLoaderProps {
  label?: string;
  compact?: boolean;
}

export function AetherLoader({ label = 'Loading your learning space', compact = false }: AetherLoaderProps) {
  return (
    <div className={`aether-loader ${compact ? 'aether-loader--compact' : ''}`} role="status" aria-live="polite">
      <div className="aether-loader__visual" aria-hidden="true">
        <span className="aether-loader__dot" />
      </div>
      <div className="aether-loader__copy">
        <span>{label}</span>
      </div>
    </div>
  );
}