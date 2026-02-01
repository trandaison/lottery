'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Global 500 - Error boundary (Phase 11).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <AlertTriangle
          className="mb-4 size-16 text-destructive"
          aria-hidden
        />
        <h1 className="text-4xl font-bold tracking-tight">Lỗi</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Đã xảy ra lỗi
        </h2>
        <p className="mt-2 text-muted-foreground">
          Ứng dụng gặp sự cố. Bạn có thể thử lại hoặc quay về trang đăng nhập.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={reset}>
            Thử lại
          </Button>
          <Button asChild>
            <Link href="/admin/login">Về trang đăng nhập</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
