import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Global 404 - Not Found page (Phase 11).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <FileQuestion
          className="mb-4 size-16 text-muted-foreground"
          aria-hidden
        />
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          Trang không tồn tại
        </h2>
        <p className="mt-2 text-muted-foreground">
          Không tìm thấy trang bạn đang tìm kiếm. Vui lòng kiểm tra lại đường
          dẫn hoặc quay về trang đăng nhập.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/admin/login">Về trang đăng nhập</Link>
        </Button>
      </div>
    </div>
  );
}
