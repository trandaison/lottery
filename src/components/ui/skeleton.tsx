import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Skeleton loader for data fetching states (Phase 11).
 */
function Skeleton({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      role="status"
      aria-label="Loading"
      {...props}
    />
  );
}

export { Skeleton };
