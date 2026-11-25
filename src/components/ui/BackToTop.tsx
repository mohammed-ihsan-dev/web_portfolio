'use client';

import { scroll } from '@/lib/scroll';
import { ArrowIcon } from './ArrowIcon';

export function BackToTop({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      className={`mono ${className ?? ''}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
      onClick={() => {
        scroll.to(0);
        document.getElementById('main')?.focus({ preventScroll: true });
      }}
    >
      {label}
      <ArrowIcon direction="up" />
    </button>
  );
}
