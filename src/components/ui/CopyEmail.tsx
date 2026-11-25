'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './CopyEmail.module.css';

/** Copies the address; announces the result politely. Falls back to mailto if the Clipboard API is blocked. */
export function CopyEmail({ email, label, copiedLabel }: { email: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <span className={styles.wrap}>
      <button type="button" className={styles.button} onClick={onCopy} data-copied={copied}>
        <span className={styles.text}>
          <span>{label}</span>
          <span aria-hidden="true">{copiedLabel}</span>
        </span>
        <span className={styles.chip} aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none">
            {copied ? (
              <path d="M2.5 6.4 5 8.7l4.5-5.2" stroke="currentColor" strokeWidth="1.4" />
            ) : (
              <path d="M4 4V2.5h5.5V8H8M2.5 4h5.5v5.5H2.5z" stroke="currentColor" strokeWidth="1.2" />
            )}
          </svg>
        </span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? `${email} copied to clipboard` : ''}
      </span>
    </span>
  );
}
