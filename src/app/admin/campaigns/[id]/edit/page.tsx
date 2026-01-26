'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CampaignForm } from '@/components/admin/CampaignForm';
import type { CampaignWithPrizes } from '@/types';
import { toast } from 'sonner';
import { use } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditCampaignPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignWithPrizes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const response = await fetch(`/api/v1/admin/campaigns/${resolvedParams.id}`);
        const result = await response.json();

        if (result.success) {
          setCampaign(result.data);
        } else {
          toast.error('Failed to load campaign');
          router.push('/admin/campaigns');
        }
      } catch (error) {
        console.error('Error fetching campaign:', error);
        toast.error('Failed to load campaign');
        router.push('/admin/campaigns');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaign();
  }, [resolvedParams.id, router]);

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/v1/admin/campaigns/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          startTime: data.startTime.toISOString(),
          endTime: data.endTime.toISOString(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Campaign updated successfully');
        router.push('/admin/campaigns');
      } else {
        toast.error(result.error?.message || 'Failed to update campaign');
      }
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    }
  };

  const handleCancel = () => {
    router.push('/admin/campaigns');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading campaign...</div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Campaign not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Campaign</h1>
        <p className="text-muted-foreground">Update campaign details</p>
      </div>

      <CampaignForm
        mode="edit"
        campaign={campaign}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>
  );
}
