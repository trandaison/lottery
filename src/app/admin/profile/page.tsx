'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/lib/context/AuthContext';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const profileSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6).max(255).optional().or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
    phone: z.string().max(20).optional(),
  })
  .refine(
    (data) => {
      const p = (data.password ?? '').trim();
      const c = (data.confirmPassword ?? '').trim();
      if (p === '') return true; // no password change
      return p === c;
    },
    { message: 'Passwords do not match', path: ['confirmPassword'] },
  );

type ProfileValues = z.infer<typeof profileSchema>;

export default function AdminProfilePage() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '',
        confirmPassword: '',
        phone: user.phone ?? '',
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileValues) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/admin/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password || undefined,
          phone: data.phone || null,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Profile updated');
        await refresh();
      } else {
        toast.error(result.error?.message ?? 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex justify-center py-8 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">Cập nhật thông tin cá nhân</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-lg">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Full name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password (leave blank to keep)</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="••••••••" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Confirm password" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="0123456789" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Update profile'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
