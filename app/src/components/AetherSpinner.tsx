interface AetherSpinnerProps {
  className?: string;
}

/** Tiny inline animated spinner for buttons and small loading states. */
export function AetherSpinner({ className = '' }: AetherSpinnerProps) {
  return (
    <span className={`aether-spinner ${className}`} role="status" aria-label="Loading">
      <span className="aether-spinner__ring" />
      <span className="aether-spinner__dot" />
    </span>
  );
}
