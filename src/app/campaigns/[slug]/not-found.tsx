import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Campaign Not Found Page
 * 
 * Displays 404 error when campaign slug is invalid
 */
export default function CampaignNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">
          Campaign không tồn tại
        </h2>
        <p className="text-gray-600 mb-8">
          Không tìm thấy campaign bạn đang tìm kiếm. Vui lòng kiểm tra lại đường dẫn hoặc quay về trang chủ.
        </p>
        <Link href="/">
          <Button size="lg">
            Về trang chủ
          </Button>
        </Link>
      </div>
    </div>
  );
}
