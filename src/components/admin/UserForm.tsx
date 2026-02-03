'use client';

import { useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { User } from '@/db/schema';
import { generateStrongPassword } from '@/lib/utils/password';
import { KeyRound } from 'lucide-react';

const createSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email').max(255),
    password: z.string().min(6, 'Password must be at least 6 characters').max(255),
    confirmPassword: z.string(),
    phone: z.string().max(20).optional(),
    role: z.enum(['admin', 'user']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const editSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(6).max(255).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive']),
  role: z.enum(['admin', 'user']),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

type UserPublic = Omit<User, 'passwordDigest'>;

interface UserFormProps {
  mode: 'create' | 'edit';
  user?: UserPublic | null;
  onSubmit: (data: CreateValues | EditValues) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function UserForm({
  mode,
  user,
  onSubmit,
  onCancel,
  isLoading = false,
}: UserFormProps) {
  const isEdit = mode === 'edit';

  const form = useForm<CreateValues | EditValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: isEdit
      ? {
          name: user?.name ?? '',
          email: user?.email ?? '',
          password: '',
          phone: user?.phone ?? '',
          status: user?.status ?? 'active',
          role: user?.role ?? 'user',
        }
      : {
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          phone: '',
          role: 'user',
        },
  });

  useEffect(() => {
    if (isEdit && user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '',
        phone: user.phone ?? '',
        status: user.status,
        role: user.role,
      } as EditValues);
    }
  }, [isEdit, user, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    if (isEdit) {
      const payload = { ...data, password: (data as EditValues).password || undefined };
      await onSubmit(payload as EditValues);
    } else {
      await onSubmit(data as CreateValues);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
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
              <div className="flex items-center justify-between gap-2">
                <FormLabel>{isEdit ? 'New password (leave blank to keep)' : 'Password'}</FormLabel>
                {!isEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const pwd = generateStrongPassword(12);
                      form.setValue('password', pwd);
                      form.setValue('confirmPassword', pwd);
                    }}
                  >
                    <KeyRound className="mr-1 size-4" />
                    Generate
                  </Button>
                )}
              </div>
              <FormControl>
                <PasswordInput placeholder={isEdit ? '••••••••' : 'Min 6 characters'} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {!isEdit && (
          <FormField
            control={form.control}
            name={'confirmPassword' as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Confirm password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
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
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {isEdit && (
          <FormField
            control={form.control}
            name={'status' as const}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
