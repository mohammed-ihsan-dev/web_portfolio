/** Diagonal ↗ arrow, 1.4px stroke, inherits colour. */
export function ArrowIcon({ direction = 'up-right', className }: { direction?: 'up-right' | 'right' | 'up' | 'left'; className?: string }) {
  const rotate = { 'up-right': 0, right: 45, up: -45, left: 225 }[direction];
  return (
    <svg
      className={`icon-arrow ${className ?? ''}`}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <path d="M2.5 9.5 9.5 2.5M4 2.5h5.5V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
    </svg>
  );
}
