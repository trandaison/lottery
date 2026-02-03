'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Info, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { highlightMatch } from '@/lib/utils/highlight-match';

type PaymentStatus = 'pending' | 'success' | 'failed';

interface OrderRow {
  id: number;
  paymentReferenceId: string;
  paymentStatus: PaymentStatus;
  errorMessage: string | null;
  user: { id: number; name: string; email: string };
  ticketsCount: number;
  totalAmount: number;
  sepayTransactionId: string | null;
  receivedAt: string | null;
  transactionDate: string | null;
  createdAt: string;
}

const statusLabels: Record<PaymentStatus, string> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
};

export default function CampaignOrdersPage() {
  const params = useParams();
  const campaignId = Number(params?.id);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmStatus, setConfirmStatus] = useState<{
    orderId: number;
    newStatus: PaymentStatus;
  } | null>(null);
  const [confirmStatusLoading, setConfirmStatusLoading] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<'delete' | 'updateStatus' | null>(null);
  const [bulkNewStatus, setBulkNewStatus] = useState<PaymentStatus>('pending');
  const [bulkLoading, setBulkLoading] = useState(false);

  const limit = 30;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchOrders = useCallback(async () => {
    if (Number.isNaN(campaignId)) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', String(limit));
      q.set('sortBy', sortBy);
      q.set('sortOrder', sortOrder);
      if (statusFilter !== 'all') q.set('status', statusFilter);
      if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/orders?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders);
        setTotal(data.data.pagination.total);
      } else {
        toast.error(data.error?.message ?? 'Failed to load orders');
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, statusFilter, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const totalPages = Math.ceil(total / limit);
  const allSelected = orders.length > 0 && selectedIds.size === orders.length;
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleStatusChange = (orderId: number, newStatus: PaymentStatus) => {
    setConfirmStatus({ orderId, newStatus });
  };

  const confirmStatusSave = async () => {
    if (!confirmStatus) return;
    setConfirmStatusLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/orders/${confirmStatus.orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus: confirmStatus.newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Cập nhật trạng thái thành công');
        setConfirmStatus(null);
        fetchOrders();
      } else {
        toast.error(data.error?.message ?? 'Cập nhật thất bại');
      }
    } catch (e) {
      toast.error('Cập nhật thất bại');
    } finally {
      setConfirmStatusLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (!someSelected || !campaignId) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', orderIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã xóa ${data.data.deleted} đơn hàng`);
        setConfirmBulk(null);
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        toast.error(data.error?.message ?? 'Xóa thất bại');
      }
    } catch (e) {
      toast.error('Xóa thất bại');
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkUpdateStatus = async () => {
    if (!someSelected || !campaignId) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          orderIds: Array.from(selectedIds),
          paymentStatus: bulkNewStatus,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Đã cập nhật ${data.data.updated} đơn hàng`);
        setConfirmBulk(null);
        setSelectedIds(new Set());
        fetchOrders();
      } else {
        toast.error(data.error?.message ?? 'Cập nhật thất bại');
      }
    } catch (e) {
      toast.error('Cập nhật thất bại');
    } finally {
      setBulkLoading(false);
    }
  };

  const formatVnd = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  const formatDate = (s: string | null) =>
    s ? format(new Date(s), 'dd/MM/yyyy HH:mm') : '—';

  const formatErrorMessage = (s: string | null) => {
    if (!s) return '';

    try {
      const error = JSON.parse(s);
      return JSON.stringify(error, null, 2);
    } catch (err) {
      return s;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to campaigns">
          <Link href="/admin/campaigns">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Campaign ID: {campaignId} · {total} đơn hàng
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Tìm mã đơn (paymentReferenceId)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-[260px]"
          aria-label="Tìm mã đơn"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        {someSelected && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmBulk('updateStatus')}
              disabled={bulkLoading}
            >
              Cập nhật trạng thái ({selectedIds.size})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmBulk('delete')}
              disabled={bulkLoading}
            >
              Xóa đã chọn
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Chưa có đơn hàng nào.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-8">STT</TableHead>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Người mua</TableHead>
                <TableHead className="text-right">Số vé</TableHead>
                <TableHead className="text-right">Tổng tiền</TableHead>
                <TableHead>SePay ID</TableHead>
                <TableHead>receivedAt</TableHead>
                <TableHead>transactionDate</TableHead>
                <TableHead>createdAt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order, idx) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => toggleSelect(order.id)}
                      aria-label={`Select order ${order.paymentReferenceId}`}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(page - 1) * limit + idx + 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {highlightMatch(order.paymentReferenceId, debouncedSearch)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Select
                        value={order.paymentStatus}
                        onValueChange={(v) => handleStatusChange(order.id, v as PaymentStatus)}
                      >
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="success">Success</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      {order.paymentStatus === 'failed' && order.errorMessage && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0"
                              aria-label="Xem lỗi"
                            >
                              <Info className="size-4 text-red-600" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96" align="start">
                            <p className="text-sm font-medium mb-1">Lỗi thanh toán</p>
                            <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                              {formatErrorMessage(order.errorMessage)}
                            </p>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{order.user.name}</div>
                      <div className="text-xs text-muted-foreground">{order.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{order.ticketsCount}</TableCell>
                  <TableCell className="text-right">{formatVnd(order.totalAmount)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {order.sepayTransactionId ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(order.receivedAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(order.transactionDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Trang {page} / {totalPages} · {total} đơn
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      {/* Confirm single status change */}
      <Dialog open={!!confirmStatus} onOpenChange={(open) => !open && setConfirmStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận đổi trạng thái</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn đổi trạng thái đơn hàng thành{' '}
              <strong>{confirmStatus ? statusLabels[confirmStatus.newStatus] : ''}</strong>?
              {confirmStatus?.newStatus === 'success' &&
                ' Nếu đơn đang pending, hệ thống sẽ tạo vé và gửi email (cập nhật thủ công, không lưu thông tin webhook).'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmStatus(null)}
              disabled={confirmStatusLoading}
            >
              Hủy
            </Button>
            <Button onClick={confirmStatusSave} disabled={confirmStatusLoading}>
              {confirmStatusLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk delete */}
      <Dialog
        open={confirmBulk === 'delete'}
        onOpenChange={(open) => !open && setConfirmBulk(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa đơn hàng đã chọn</DialogTitle>
            <DialogDescription>
              Bạn có chắc muốn xóa {selectedIds.size} đơn hàng? Hành động không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulk(null)} disabled={bulkLoading}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={bulkDelete} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm bulk update status */}
      <Dialog
        open={confirmBulk === 'updateStatus'}
        onOpenChange={(open) => !open && setConfirmBulk(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái hàng loạt</DialogTitle>
            <DialogDescription>
              Chọn trạng thái mới cho {selectedIds.size} đơn hàng. Nếu chọn Success cho đơn đang
              Pending, hệ thống sẽ tạo vé và gửi email (cập nhật thủ công).
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={bulkNewStatus} onValueChange={(v) => setBulkNewStatus(v as PaymentStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulk(null)} disabled={bulkLoading}>
              Hủy
            </Button>
            <Button onClick={bulkUpdateStatus} disabled={bulkLoading}>
              {bulkLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
