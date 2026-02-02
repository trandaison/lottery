'use client';

import { Fragment, type ReactNode } from 'react';

/**
 * Splits text by query (case-insensitive) and wraps each match in a yellow highlight span.
 * Returns React nodes for use in table cells. If query is empty, returns plain text.
 */
export function highlightMatch(text: string, query: string): ReactNode {
  if (!query || !query.trim()) return text;
  const q = query.trim();
  const lowerQ = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    const idx = remaining.toLowerCase().indexOf(lowerQ);
    if (idx === -1) {
      parts.push(<Fragment key={key++}>{remaining}</Fragment>);
      break;
    }
    parts.push(<Fragment key={key++}>{remaining.slice(0, idx)}</Fragment>);
    parts.push(
      <span
        key={key++}
        className="bg-yellow-200 dark:bg-yellow-600/50 rounded px-0.5"
        aria-hidden
      >
        {remaining.slice(idx, idx + q.length)}
      </span>
    );
    remaining = remaining.slice(idx + q.length);
  }
  return <>{parts}</>;
}
