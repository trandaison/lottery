'use client';

import { useRouter } from 'next/navigation';
import { UserForm, type CreateValues, type EditValues } from '@/components/admin/UserForm';
import { toast } from 'sonner';

export default function NewUserPage() {
  const router = useRouter();

  const handleSubmit = async (data: CreateValues | EditValues) => {
    const payload = data as CreateValues;
    try {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          email: payload.email,
          password: payload.password,
          confirmPassword: payload.confirmPassword,
          phone: payload.phone ?? null,
          role: payload.role,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('User created');
        router.push('/admin/users');
      } else {
        toast.error(result.error?.message ?? 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error('Failed to create user');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New User</h1>
        <p className="text-muted-foreground">Create a new user</p>
      </div>
      <UserForm
        mode="create"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/users')}
      />
    </div>
  );
}
