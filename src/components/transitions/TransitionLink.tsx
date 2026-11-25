'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useTransitionNav } from './TransitionProvider';

type Props = Omit<ComponentProps<typeof Link>, 'href' | 'onNavigate'> & {
  href: string;
  /** Shared-element id: matches `data-flip-source` here and `data-flip-target` on the destination. */
  flipId?: string;
  /** Small label shown on the curtain while it covers the page. */
  transitionLabel?: string;
};

/**
 * Next <Link> that plays the site transition. Modified clicks (cmd/ctrl/middle)
 * keep native behaviour because `onNavigate` only fires for SPA navigations.
 */
export function TransitionLink({ href, flipId, transitionLabel, children, ...rest }: Props) {
  const { navigate } = useTransitionNav();
  return (
    <Link
      href={href}
      {...rest}
      onNavigate={(e) => {
        e.preventDefault();
        navigate(href, { flipId, label: transitionLabel });
      }}
    >
      {children}
    </Link>
  );
}
