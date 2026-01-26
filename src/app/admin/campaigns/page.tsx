'use client';

import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminCampaignsPage() {
  const { user, logout, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Campaign Management</h1>
            <p className="text-gray-600 mt-2">
              Welcome back, {user?.name || 'Admin'}!
            </p>
          </div>
          <Button onClick={logout} variant="outline">
            Logout
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaigns</CardTitle>
            <CardDescription>
              Manage your lottery campaigns here
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                Campaign management features coming in Phase 3
              </p>
              <div className="space-y-2 text-sm text-left max-w-md mx-auto bg-gray-50 p-4 rounded-md">
                <p className="font-semibold">✅ Phase 2 Complete!</p>
                <p>
                  <strong>User:</strong> {user?.email}
                </p>
                <p>
                  <strong>Role:</strong> {user?.role}
                </p>
                <p>
                  <strong>Status:</strong> {user?.status}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
