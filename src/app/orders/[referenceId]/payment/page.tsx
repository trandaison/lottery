'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ArrowLeft,
  Home,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrderPolling } from '@/lib/hooks/useOrderPolling';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';

dayjs.extend(relativeTime);
dayjs.locale('vi');

/**
 * Payment Page with Success State
 *
 * Manages 4 states via React state:
 * 1. Pending (default for transfer payment)
 *    - Display QR code (large, scannable)
 *    - Display bank account details
 *    - Display payment reference ID
 *    - Display countdown timer (10 minutes)
 *    - Implement polling: call API every 3 seconds
 *    - Stop polling when status changes
 *
 * 2. Success (after webhook updates status)
 *    - Hide QR and countdown
 *    - Show success icon/animation
 *    - Show "Thanh toán thành công!" message
 *    - Show order details with ticket numbers
 *    - Show email notification message
 *    - Show buttons: "Quay về trang chủ", "Xem campaign"
 *
 * 3. Failed
 *    - Show error message
 *    - Show "Thử lại" button
 *
 * 4. Timeout (after 10 minutes)
 *    - Show "Hết thời gian thanh toán" message
 *    - Show "Thử lại" button
 *
 * Architecture Principles:
 * - Single responsibility: Handle payment page states
 * - Clean component design with state management
 * - Proper error handling and user feedback
 */
export default function PaymentPage() {
  const router = useRouter();
  const params = useParams();
  const referenceId = params.referenceId as string;

  const [copied, setCopied] = useState(false);
  const [remainingTime, setRemainingTime] = useState<{
    minutes: number;
    seconds: number;
  } | null>(null);
  const [initialData, setInitialData] = useState<{
    qrCodeUrl?: string;
    bankInfo?: {
      bankName: string;
      accountNumber: string;
      amount: number;
      content: string;
    };
    paymentType?: 'direct' | 'transfer';
  } | null>(null);

  // Poll order status
  const { order, tickets, campaign, isLoading, error, isExpired } = useOrderPolling({
    referenceId,
    enabled: true,
    interval: 3000,
    onStatusChange: (status) => {
      if (status === 'success') {
        toast.success('Thanh toán thành công!');
      } else if (status === 'failed') {
        toast.error('Thanh toán thất bại');
      }
    },
  });

  // Fetch initial order data to get QR code and bank info
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`/api/v1/orders/${referenceId}`);
        const result = await response.json();

        if (result.success && result.data) {
          // If direct payment, we already have tickets, no need for QR
          if (result.data.order.paymentType === 'direct') {
            setInitialData({
              paymentType: 'direct',
            });
          } else {
            // For transfer, we need to get QR from purchase response
            // For now, we'll construct it from order data if available
            // In a real scenario, this would be stored in the purchase response
            setInitialData({
              paymentType: 'transfer',
            });
          }
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      }
    };

    fetchInitialData();
  }, [referenceId]);

  // Determine current state
  const getCurrentState = (): 'pending' | 'success' | 'failed' | 'timeout' => {
    if (!order) {
      return 'pending';
    }

    if (isExpired && order.paymentStatus === 'pending') {
      return 'timeout';
    }

    if (order.paymentStatus === 'success') {
      return 'success';
    }

    if (order.paymentStatus === 'failed') {
      return 'failed';
    }

    return 'pending';
  };

  const currentState = getCurrentState();

  // Format VND currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Calculate remaining time (client-side only to avoid hydration mismatch)
  useEffect(() => {
    if (!order?.expiresAt || order.paymentType !== 'transfer') {
      setRemainingTime(null);
      return;
    }

    const calculateRemainingTime = () => {
      const now = new Date();
      const expires = new Date(order.expiresAt!);
      const diff = expires.getTime() - now.getTime();

      if (diff <= 0) {
        setRemainingTime(null);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setRemainingTime({ minutes, seconds });
    };

    // Initial calculation
    calculateRemainingTime();

    // Update every second
    const interval = setInterval(calculateRemainingTime, 1000);

    return () => clearInterval(interval);
  }, [order?.expiresAt, order?.paymentType]);

  // Copy payment reference ID
  const handleCopyReferenceId = () => {
    if (order?.paymentReferenceId) {
      navigator.clipboard.writeText(order.paymentReferenceId);
      setCopied(true);
      toast.success('Đã sao chép mã đơn hàng');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Loading state
  if (isLoading && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">Đang tải thông tin đơn hàng...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Lỗi
              </h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button onClick={() => router.push('/')} variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Về trang chủ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Don't render anything until we have order data or error
  if (!order && !error) {
    return null;
  }

  if (!order) {
    return null;
  }

  // State 1: Pending (for transfer payment)
  if (currentState === 'pending' && order.paymentType === 'transfer') {
    // Construct QR URL from campaign data
    const qrCodeUrl =
      campaign?.accountNumber && campaign?.bankNameOrCode
        ? `https://qr.sepay.vn/img?acc=${campaign.accountNumber}&bank=${campaign.bankNameOrCode}&amount=${order.totalAmount}&des=${order.paymentReferenceId}`
        : '';

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-yellow-600" />
                <CardTitle className="text-2xl">Chờ thanh toán</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Countdown Timer */}
              {remainingTime && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-yellow-800 mb-1">
                    Thời gian còn lại
                  </p>
                  <p className="text-2xl font-bold text-yellow-900">
                    {remainingTime.minutes.toString().padStart(2, '0')}:
                    {remainingTime.seconds.toString().padStart(2, '0')}
                  </p>
                </div>
              )}

              {/* QR Code */}
              {qrCodeUrl && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <Image
                      src={qrCodeUrl}
                      alt="QR Code"
                      width={300}
                      height={300}
                      className="w-full max-w-[300px] h-auto"
                    />
                  </div>
                </div>
              )}

              {/* Bank Account Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">
                  Thông tin chuyển khoản
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Số tài khoản:</span>
                    <span className="font-medium">
                      {campaign?.accountNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ngân hàng:</span>
                    <span className="font-medium">
                      {campaign?.bankNameOrCode || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Số tiền:</span>
                    <span className="font-bold text-green-600">
                      {formatVND(order.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Nội dung chuyển khoản:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-white px-2 py-1 rounded font-mono text-sm">
                        {order.paymentReferenceId}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleCopyReferenceId}
                        className="h-8 w-8"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Hướng dẫn:</strong> Quét mã QR hoặc chuyển khoản theo
                  thông tin trên. Hệ thống sẽ tự động cập nhật trạng thái sau khi
                  nhận được thanh toán.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // State 2: Success
  if (currentState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <CardTitle className="text-2xl text-green-600">
                  Thanh toán thành công!
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Success Message */}
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg text-gray-700">
                  Cảm ơn bạn đã tham gia! Vé của bạn đã được tạo thành công.
                </p>
              </div>

              {/* Order Details */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900">Thông tin đơn hàng</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mã đơn hàng:</span>
                    <span className="font-medium font-mono">
                      {order.paymentReferenceId}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Số lượng vé:</span>
                    <span className="font-medium">{order.ticketsCount} vé</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tổng tiền:</span>
                    <span className="font-bold text-green-600">
                      {formatVND(order.totalAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ticket Numbers */}
              {tickets && tickets.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Số vé của bạn:
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="bg-white rounded p-2 text-center font-mono text-sm border border-green-200"
                      >
                        {ticket.ticketNumber}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Notification */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Lưu ý:</strong> Thông tin vé đã được gửi đến email của
                  bạn. Vui lòng kiểm tra hộp thư (bao gồm thư mục spam).
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Quay về trang chủ
                </Button>
                <Button
                  onClick={() => router.back()}
                  className="flex-1"
                >
                  Xem campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // State 3: Failed
  if (currentState === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-600" />
                <CardTitle className="text-2xl text-red-600">
                  Thanh toán thất bại
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <p className="text-lg text-gray-700 mb-2">
                  Rất tiếc, thanh toán của bạn đã thất bại.
                </p>
                {order.errorMessage && (
                  <p className="text-sm text-gray-600">{order.errorMessage}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
                </Button>
                <Button onClick={() => router.push('/')} className="flex-1">
                  <Home className="mr-2 h-4 w-4" />
                  Về trang chủ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // State 4: Timeout
  if (currentState === 'timeout') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-orange-600" />
                <CardTitle className="text-2xl text-orange-600">
                  Hết thời gian thanh toán
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <Clock className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <p className="text-lg text-gray-700">
                  Thời gian thanh toán đã hết hạn. Vui lòng tạo đơn hàng mới.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.back()}
                  variant="outline"
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Quay lại
                </Button>
                <Button onClick={() => router.push('/')} className="flex-1">
                  <Home className="mr-2 h-4 w-4" />
                  Về trang chủ
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Direct payment - show success immediately
  if (order.paymentType === 'direct' && currentState === 'pending') {
    // For direct payment, tickets should already be created
    // Redirect to success view
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="container mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <CardTitle className="text-2xl text-green-600">
                  Mua vé thành công!
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-4">
                <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg text-gray-700">
                  Cảm ơn bạn đã tham gia! Vé của bạn đã được tạo thành công.
                </p>
              </div>

              {/* Ticket Numbers */}
              {tickets && tickets.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">
                    Số vé của bạn:
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tickets.map((ticket) => (
                      <div
                        key={ticket.id}
                        className="bg-white rounded p-2 text-center font-mono text-sm border border-green-200"
                      >
                        {ticket.ticketNumber}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Quay về trang chủ
                </Button>
                <Button onClick={() => router.back()} className="flex-1">
                  Xem campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
}
