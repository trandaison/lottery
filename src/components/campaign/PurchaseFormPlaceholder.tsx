'use client';

import { AlertCircle, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface PurchaseFormPlaceholderProps {
  status: 'active' | 'drawing' | 'completed' | 'canceled';
  isWithinTimeRange: boolean;
  startTime: Date;
  endTime: Date;
}

/**
 * PurchaseFormPlaceholder Component
 * 
 * Conditional display logic for purchase form:
 * - Shows purchase form only when campaign is active and within time range
 * - Shows appropriate message for other states
 * 
 * Architecture:
 * - Single responsibility: Manage purchase form visibility
 * - State-based conditional rendering
 * - Will be replaced with actual form in Phase 5
 * 
 * Display Rules:
 * - status='active' + within time range → Show form
 * - status='active' + before start → Show countdown (handled by parent)
 * - status='active' + after end → Show ended message
 * - status='drawing' → Show drawing message
 * - status='completed' → Show completed message
 * - status='canceled' → Show canceled message
 */
export function PurchaseFormPlaceholder({
  status,
  isWithinTimeRange,
  startTime,
  endTime,
}: PurchaseFormPlaceholderProps) {
  const now = new Date();
  const hasStarted = now >= startTime;
  const hasEnded = now >= endTime;

  // Campaign is canceled
  if (status === 'canceled') {
    return (
      <Card className="p-8 text-center bg-red-50 border-red-200">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-red-700 mb-2">
          Campaign đã bị hủy
        </h3>
        <p className="text-red-600">
          Campaign này đã bị hủy và không thể mua vé.
        </p>
      </Card>
    );
  }

  // Campaign is drawing
  if (status === 'drawing') {
    return (
      <Card className="p-8 text-center bg-blue-50 border-blue-200">
        <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-blue-700 mb-2">
          Campaign đã đóng
        </h3>
        <p className="text-blue-600">
          Campaign đang trong quá trình quay số. Vui lòng theo dõi kết quả.
        </p>
      </Card>
    );
  }

  // Campaign is completed
  if (status === 'completed') {
    return (
      <Card className="p-8 text-center bg-gray-50 border-gray-200">
        <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Campaign đã hoàn thành
        </h3>
        <p className="text-gray-600">
          Campaign này đã kết thúc và công bố kết quả.
        </p>
      </Card>
    );
  }

  // Campaign is active but ended
  if (status === 'active' && hasEnded) {
    return (
      <Card className="p-8 text-center bg-gray-50 border-gray-200">
        <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Campaign đã kết thúc
        </h3>
        <p className="text-gray-600">
          Thời gian mua vé đã kết thúc. Cảm ơn bạn đã quan tâm!
        </p>
      </Card>
    );
  }

  // Campaign is active but hasn't started
  if (status === 'active' && !hasStarted) {
    return (
      <Card className="p-8 text-center bg-yellow-50 border-yellow-200">
        <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-yellow-700 mb-2">
          Campaign chưa bắt đầu
        </h3>
        <p className="text-yellow-600">
          Vui lòng quay lại khi campaign bắt đầu để mua vé.
        </p>
      </Card>
    );
  }

  // Campaign is active and within time range - show purchase form placeholder
  if (status === 'active' && isWithinTimeRange) {
    return (
      <Card className="p-8 bg-white border-2 border-green-200">
        <div className="flex items-center gap-3 mb-6">
          <ShoppingCart className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-semibold text-gray-900">Mua vé dự thưởng</h3>
        </div>
        
        {/* Placeholder for actual purchase form (Phase 5) */}
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <p className="text-gray-600 mb-4">
            Form mua vé sẽ được implement trong Phase 5
          </p>
          <Button disabled className="w-full">
            Chức năng đang được phát triển
          </Button>
        </div>
      </Card>
    );
  }

  // Default fallback
  return null;
}
