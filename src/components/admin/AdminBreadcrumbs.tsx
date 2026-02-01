'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

/**
 * Breadcrumbs for admin top bar (Phase 11).
 * Renders: Campaigns > New | Campaigns > Edit | Campaigns
 */
export function AdminBreadcrumbs() {
  const pathname = usePathname() ?? '';

  if (!pathname.startsWith('/admin') || pathname === '/admin') {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const items: { label: string; href: string; isLast: boolean }[] = [];
  let pathSoFar = '/admin';

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    pathSoFar += `/${seg}`;
    const isLast = i === segments.length - 1;
    if (seg === 'campaigns') {
      items.push({ label: 'Campaigns', href: pathSoFar, isLast });
    } else if (seg === 'new') {
      items.push({ label: 'New', href: pathSoFar, isLast });
    } else if (seg === 'edit') {
      items.push({ label: 'Edit', href: pathSoFar, isLast });
    } else if (seg === 'draw') {
      items.push({ label: 'Draw', href: pathSoFar, isLast });
    } else if (seg === 'orders') {
      items.push({ label: 'Orders', href: pathSoFar, isLast });
    } else if (seg === 'tickets') {
      items.push({ label: 'Tickets', href: pathSoFar, isLast });
    } else if (/^\d+$/.test(seg)) {
      const next = segments[i + 1];
      if (next === 'edit' || next === 'draw' || next === 'orders' || next === 'tickets') {
        items.push({ label: seg, href: pathSoFar, isLast });
      }
    }
  }

  if (items.length === 0) {
    items.push({ label: 'Campaigns', href: '/admin/campaigns', isLast: true });
  } else {
    items[items.length - 1] = { ...items[items.length - 1], isLast: true };
  }

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {items.map((item, i) => (
        <span key={`${item.href}-${i}`} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              className="size-4 text-muted-foreground"
              aria-hidden
            />
          )}
          {item.isLast ? (
            <span className="font-medium text-foreground" aria-current="page">
              {item.label}
            </span>
          ) : (
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {item.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
