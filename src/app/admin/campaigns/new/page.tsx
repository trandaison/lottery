'use client';

import { useRouter } from 'next/navigation';
import { CampaignForm } from '@/components/admin/CampaignForm';
import { toast } from 'sonner';

export default function NewCampaignPage() {
  const router = useRouter();

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch('/api/v1/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startTime: data.startTime.toISOString(),
          endTime: data.endTime.toISOString(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Campaign created successfully');
        router.push('/admin/campaigns');
      } else {
        toast.error(result.error?.message || 'Failed to create campaign');
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Failed to create campaign');
    }
  };

  const handleCancel = () => {
    router.push('/admin/campaigns');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create New Campaign</h1>
        <p className="text-muted-foreground">Set up a new lottery campaign</p>
      </div>

      <CampaignForm mode="create" onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
