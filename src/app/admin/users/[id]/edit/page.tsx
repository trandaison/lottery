'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UserForm, type CreateValues, type EditValues } from '@/components/admin/UserForm';
import type { User } from '@/db/schema';
import { toast } from 'sonner';
import { use } from 'react';

type UserPublic = Omit<User, 'passwordDigest'>;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`/api/v1/admin/users/${resolvedParams.id}`);
        const result = await response.json();
        if (result.success) {
          setUser(result.data);
        } else {
          toast.error('Failed to load user');
          router.push('/admin/users');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        toast.error('Failed to load user');
        router.push('/admin/users');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [resolvedParams.id, router]);

  const handleSubmit = async (data: CreateValues | EditValues) => {
    const payload = data as EditValues;
    try {
      const response = await fetch(`/api/v1/admin/users/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password || undefined,
          phone: payload.phone ?? null,
          status: payload.status,
          role: payload.role,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('User updated');
        router.push('/admin/users');
      } else {
        toast.error(result.error?.message ?? 'Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        Loading user...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit User</h1>
        <p className="text-muted-foreground">Update user details</p>
      </div>
      <UserForm
        mode="edit"
        user={user}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/users')}
      />
    </div>
  );
}
