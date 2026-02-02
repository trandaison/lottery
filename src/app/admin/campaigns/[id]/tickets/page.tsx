'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { highlightMatch } from '@/lib/utils/highlight-match';

interface TicketRow {
  id: number;
  ticketNumber: string;
  user: { id: number; name: string; email: string };
  prizeTitle: string | null;
  isWinning: boolean;
  createdAt: string;
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Ngày mua vé' },
  { value: 'status', label: 'Trạng thái' },
  { value: 'ticketNumber', label: 'Số vé' },
  { value: 'userName', label: 'Nickname' },
] as const;

export default function CampaignTicketsPage() {
  const params = useParams();
  const campaignId = Number(params?.id);
  const [ticketsList, setTicketsList] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const limit = 100;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchTickets = useCallback(async () => {
    if (Number.isNaN(campaignId)) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set('page', String(page));
      q.set('limit', String(limit));
      q.set('sortBy', sortBy);
      q.set('sortOrder', sortOrder);
      if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/v1/admin/campaigns/${campaignId}/tickets?${q.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTicketsList(data.data.tickets);
        setTotal(data.data.pagination.total);
      } else {
        toast.error(data.error?.message ?? 'Không tải được danh sách vé');
      }
    } catch (e) {
      console.error(e);
      toast.error('Không tải được danh sách vé');
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const totalPages = Math.ceil(total / limit);
  const formatDate = (s: string) => format(new Date(s), 'dd/MM/yyyy HH:mm');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Quay lại campaigns">
          <Link href="/admin/campaigns">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">
            Campaign ID: {campaignId} · {total} vé đã bán
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Input
          placeholder="Tìm số vé (chứa)..."
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-[220px]"
          aria-label="Tìm số vé"
        />
        <span className="text-sm text-muted-foreground">Sắp xếp:</span>
        <Select
          value={sortBy}
          onValueChange={(v) => {
            setSortBy(v);
            setPage(1);
          }}
          aria-label="Sắp xếp theo"
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sortOrder}
          onValueChange={(v) => {
            setSortOrder(v);
            setPage(1);
          }}
          aria-label="Thứ tự"
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Mới nhất trước</SelectItem>
            <SelectItem value="asc">Cũ nhất trước</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : ticketsList.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          Chưa có vé nào được bán.
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">STT</TableHead>
                <TableHead>Số vé</TableHead>
                <TableHead>Người mua</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian mua</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ticketsList.map((ticket, idx) => (
                <TableRow key={ticket.id}>
                  <TableCell className="text-muted-foreground">
                    {(page - 1) * limit + idx + 1}
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {highlightMatch(ticket.ticketNumber, debouncedSearch)}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{ticket.user.name}</div>
                      <div className="text-xs text-muted-foreground">{ticket.user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ticket.isWinning && ticket.prizeTitle ? (
                      <Badge variant="secondary">{ticket.prizeTitle}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                    {formatDate(ticket.createdAt)}
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
            Trang {page} / {totalPages} · {total} vé
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
    </div>
  );
}
