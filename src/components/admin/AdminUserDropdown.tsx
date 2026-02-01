'use client';

import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/lib/context/AuthContext';
import { useState } from 'react';

/**
 * User dropdown in admin top bar (Phase 11).
 */
export function AdminUserDropdown() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.push('/admin/login');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label="Open user menu"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <User className="size-4" aria-hidden />
          <span className="hidden truncate max-w-[120px] sm:inline">
            {user.name}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-2">
          <div className="text-sm">
            <p className="font-medium truncate">{user.name}</p>
            <p className="text-muted-foreground truncate text-xs">
              {user.email}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="mr-2 size-4" aria-hidden />
            Logout
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
