'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { forgotPasswordSchema } from '@/lib/validations/auth';

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

const SUCCESS_MESSAGE =
  'If an account exists with this email, we sent a link to your email.';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const { register, handleSubmit, formState: { errors } } = form;

  const onSubmit = handleSubmit(async (data) => {
    setIsSubmitting(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/v1/admin/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });
      const json = await res.json();

      if (!res.ok && json.error?.code === 'VALIDATION_ERROR') {
        setError(json.error?.message ?? 'Invalid request');
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Forgot password
          </CardTitle>
          <CardDescription className="text-center">
            Enter your email and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-green-50 border border-green-200">
                <p className="text-sm text-green-800">{SUCCESS_MESSAGE}</p>
              </div>
              <Button asChild variant="outline" className="w-full" size="lg">
                <Link href="/admin/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  {...register('email')}
                  disabled={isSubmitting}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email.message}</p>
                )}
              </div>

              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
                size="lg"
              >
                {isSubmitting ? 'Sending...' : 'Send reset link'}
              </Button>

              <div className="text-center">
                <Link
                  href="/admin/login"
                  className="text-sm text-primary hover:underline"
                >
                  Back to login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
