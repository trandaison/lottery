'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LayoutDashboard, LogOut, Menu, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/context/AuthContext';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import { AdminUserDropdown } from '@/components/admin/AdminUserDropdown';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // All hooks must run before any early return (Rules of Hooks)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Guest layout: no sidebar/header (login, forgot-password, reset-password)
  if (
    pathname === '/admin/login' ||
    pathname === '/admin/forgot-password' ||
    pathname === '/admin/reset-password'
  ) {
    return <>{children}</>;
  }

  if (pathname?.includes('/admin/campaigns/') && pathname?.includes('/draw')) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" role="status" aria-live="polite">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.replace('/admin/login');
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar - hidden on mobile unless open */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex-shrink-0 border-r bg-background/95 backdrop-blur
          lg:sticky lg:block lg:bg-muted/30
          ${sidebarOpen ? 'block' : 'hidden'}
        `}
        aria-label="Admin navigation"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b px-4 lg:justify-center">
            <Link href="/admin/campaigns" className="text-lg font-bold">
              Lottery Admin
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <X className="size-5" aria-hidden />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Main">
            <Link href="/admin/campaigns">
              <Button
                variant={pathname?.startsWith('/admin/campaigns') ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                aria-current={pathname?.startsWith('/admin/campaigns') ? 'page' : undefined}
              >
                <LayoutDashboard className="mr-2 size-4" aria-hidden />
                Campaigns
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button
                variant={pathname?.startsWith('/admin/users') ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                aria-current={pathname?.startsWith('/admin/users') ? 'page' : undefined}
              >
                <Users className="mr-2 size-4" aria-hidden />
                Users
              </Button>
            </Link>
          </nav>

          <div className="border-t p-4">
            <div className="mb-2 text-sm">
              <div className="font-medium">{user.name}</div>
              <div className="text-muted-foreground truncate text-xs">{user.email}</div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogOut className="mr-2 size-4" aria-hidden />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Top bar + main content */}
      <div className="flex flex-1 flex-col min-h-screen">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            aria-expanded={sidebarOpen}
          >
            <Menu className="size-5" aria-hidden />
          </Button>
          <div className="flex-1 overflow-hidden">
            <AdminBreadcrumbs />
          </div>
          <AdminUserDropdown />
        </header>

        <main className="flex-1">
          <div className="mx-auto py-6 px-4 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
