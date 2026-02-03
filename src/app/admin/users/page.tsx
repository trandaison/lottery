'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatPhoneDisplay } from '@/lib/utils/phone';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { format } from 'date-fns';
import type { User } from '@/db/schema';

type UserPublic = Omit<User, 'passwordDigest'>;
type SortKey = 'name' | 'email' | 'phone' | 'role' | 'createdAt';

const SORT_KEYS: SortKey[] = ['name', 'email', 'phone', 'role', 'createdAt'];
const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  email: 'Email',
  phone: 'Phone',
  role: 'Role',
  createdAt: 'Ngày đăng ký',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const debouncedSearch = useDebounce(searchTerm, 300);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const response = await fetch(`/api/v1/admin/users?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setUsers(result.data.users);
        setTotal(result.data.total);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, sortBy, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortBy !== column) return <ArrowUpDown className="ml-1 size-4 opacity-50" aria-hidden />;
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 size-4" aria-hidden />
    ) : (
      <ArrowDown className="ml-1 size-4" aria-hidden />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Quản lý user</p>
        </div>
        <Button asChild>
          <Link href="/admin/users/new">
            <Plus className="mr-2 size-4" />
            New User
          </Link>
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          type="search"
          placeholder="Search name, email, phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
          aria-label="Search users"
        />
      </div>

      {loading ? (
        <div className="rounded-md border">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground">No users found</p>
          <Button asChild className="mt-4">
            <Link href="/admin/users/new">Create first user</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">STT</TableHead>
                {SORT_KEYS.map((key) => (
                  <TableHead key={key}>
                    <button
                      type="button"
                      className="inline-flex items-center font-medium hover:underline"
                      onClick={() => toggleSort(key)}
                      aria-label={`Sort by ${SORT_LABELS[key]}`}
                    >
                      {SORT_LABELS[key]}
                      <SortIcon column={key} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user, index) => (
                <TableRow key={user.id}>
                  <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{formatPhoneDisplay(user.phone)}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(user.createdAt), 'PPp')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/users/${user.id}/edit`}>
                        <Edit className="mr-2 size-4" />
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex justify-between text-sm text-muted-foreground">
        <span>Showing {users.length} of {total} users</span>
      </div>
    </div>
  );
}
