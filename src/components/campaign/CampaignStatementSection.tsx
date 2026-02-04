'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';

type PaymentStatus = 'pending' | 'success' | 'failed';

interface StatementRow {
  paymentReferenceId: string;
  paymentStatus: PaymentStatus;
  emailMasked: string;
  ticketsCount: number;
  totalAmount: number;
  createdAt: string;
}

const statusLabels: Record<PaymentStatus, string> = {
  pending: 'Đang chờ',
  success: 'Thành công',
  failed: 'Thất bại',
};

interface CampaignStatementSectionProps {
  campaignSlug: string;
}

export function CampaignStatementSection({ campaignSlug }: CampaignStatementSectionProps) {
  const [orders, setOrders] = useState<StatementRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStatement = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignSlug}/statement`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders ?? []);
      } else {
        toast.error(data.error?.message ?? 'Không tải được danh sách sao kê');
      }
    } catch (e) {
      console.error(e);
      toast.error('Không tải được danh sách sao kê');
    } finally {
      setLoading(false);
    }
  };

  const formatVnd = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  const formatDate = (s: string) => format(new Date(s), 'dd/MM/yyyy HH:mm');

  const rowBg = (status: PaymentStatus) => {
    if (status === 'failed') return 'bg-red-100';
    if (status === 'pending') return 'bg-gray-100';
    return '';
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Sao kê</h2>

      {orders === null ? (
        <div>
          <Button
            onClick={loadStatement}
            disabled={loading}
            aria-label="Xem danh sách sao kê"
          >
            {loading ? 'Đang tải...' : 'Xem danh sách'}
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">STT</TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Số vé</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead className="text-right">createdAt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Chưa có đơn hàng nào.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order, idx) => (
                    <TableRow key={order.paymentReferenceId} className={rowBg(order.paymentStatus)}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {order.paymentReferenceId}
                      </TableCell>
                      <TableCell>{statusLabels[order.paymentStatus]}</TableCell>
                      <TableCell className="font-mono text-sm">{order.emailMasked}</TableCell>
                      <TableCell className="text-right">{order.ticketsCount}</TableCell>
                      <TableCell className="text-right">{formatVnd(order.totalAmount)}</TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap text-right">
                        {formatDate(order.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  );
}
