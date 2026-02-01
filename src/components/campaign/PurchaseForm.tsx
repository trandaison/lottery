'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import type { ApiResponse } from '@/types';

/**
 * Purchase form validation schema
 */
const purchaseFormSchema = z.object({
  name: z.string().min(1, 'Tên là bắt buộc'),
  email: z.string().email('Email không hợp lệ'),
  phone: z.string().regex(/^0\d{9}$/, 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0'),
  ticketsCount: z.number().int().min(1, 'Số lượng vé phải lớn hơn 0').max(100, 'Không thể mua quá 100 vé một lần'),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface PurchaseFormProps {
  campaignSlug: string;
  ticketPrice: number;
}

/**
 * PurchaseForm Component
 *
 * Handles ticket purchase with:
 * - Form validation (React Hook Form + Zod)
 * - Quantity selector with price calculation
 * - Phone validation: /^0\d{9}$/
 * - Form submission with loading states
 * - Navigation to payment page on success
 *
 * Architecture Principles:
 * - Single responsibility: Handle purchase form UI and submission
 * - Clean component design
 * - Proper error handling and user feedback
 */
export function PurchaseForm({ campaignSlug, ticketPrice }: PurchaseFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      ticketsCount: 1,
    },
  });

  const { handleSubmit, watch, setValue } = form;
  const ticketsCount = watch('ticketsCount');
  const totalAmount = ticketsCount * ticketPrice;

  // Format VND currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/v1/tickets/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignSlug,
          name: data.name,
          email: data.email,
          phone: data.phone,
          ticketsCount: data.ticketsCount,
        }),
      });

      const result: ApiResponse = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || 'Có lỗi xảy ra khi mua vé');
        return;
      }

      // Get payment reference ID from response
      const responseData = result.data as { order?: { paymentReferenceId?: string } } | undefined;
      const paymentReferenceId = responseData?.order?.paymentReferenceId;

      if (!paymentReferenceId) {
        toast.error('Không nhận được mã đơn hàng');
        return;
      }

      // Navigate to payment page
      router.push(`/orders/${paymentReferenceId}/payment`);
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <Card className="bg-white border-2 border-green-200">
      <CardHeader>
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6 text-green-600" />
          <CardTitle className="text-xl font-semibold text-gray-900">
            Mua vé dự thưởng
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Name Field */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ và tên *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Nguyễn Văn A"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email Field */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="email@example.com"
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone Field */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số điện thoại *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="tel"
                      placeholder="0901234567"
                      maxLength={10}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tickets Count Field */}
            <FormField
              control={form.control}
              name="ticketsCount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số lượng vé *</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (field.value > 1) {
                            setValue('ticketsCount', field.value - 1);
                          }
                        }}
                        disabled={isSubmitting || field.value <= 1}
                      >
                        -
                      </Button>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={100}
                        className="text-center"
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10);
                          if (!isNaN(value) && value >= 1 && value <= 100) {
                            setValue('ticketsCount', value);
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (field.value < 100) {
                            setValue('ticketsCount', field.value + 1);
                          }
                        }}
                        disabled={isSubmitting || field.value >= 100}
                      >
                        +
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Giá vé:</span>
                <span className="font-medium">{formatVND(ticketPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Số lượng:</span>
                <span className="font-medium">{ticketsCount} vé</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Tổng cộng:</span>
                <span className="font-bold text-lg text-green-600">
                  {formatVND(totalAmount)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                'Mua vé ngay'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
