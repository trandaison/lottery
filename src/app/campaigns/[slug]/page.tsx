import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { campaignService } from '@/services/campaign.service';
import { CampaignHeader } from '@/components/campaign/CampaignHeader';
import { CampaignStats } from '@/components/campaign/CampaignStats';
import { CampaignDescription } from '@/components/campaign/CampaignDescription';
import { PrizeTable } from '@/components/campaign/PrizeTable';
import { CountdownTimer } from '@/components/campaign/CountdownTimer';
import { PurchaseFormPlaceholder } from '@/components/campaign/PurchaseFormPlaceholder';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

interface CampaignPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: CampaignPageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await campaignService.getBySlug(slug);

  if (!campaign) {
    return {
      title: 'Campaign không tồn tại',
    };
  }

  return {
    title: `${campaign.title} | Lottery`,
    description: campaign.description || `Tham gia campaign ${campaign.title}`,
  };
}

/**
 * Public Campaign Detail Page
 * 
 * Displays complete campaign information with:
 * - Campaign header (title, status, dates, price)
 * - Campaign statistics (tickets sold, participants, revenue)
 * - Countdown timer (before start time)
 * - Campaign description (markdown)
 * - Prize table
 * - Conditional purchase form
 * 
 * Architecture:
 * - Server-side rendering for SEO and performance
 * - Component composition for clean code
 * - Conditional rendering based on campaign status and time
 * 
 * Display Logic:
 * - Before start_time: Show countdown, hide purchase form
 * - Between start/end time + status='active': Show purchase form
 * - After end_time OR status!='active': Show appropriate message
 */
export default async function CampaignPage({ params }: CampaignPageProps) {
  const { slug } = await params;

  // Fetch campaign data (SSR)
  const campaign = await campaignService.getBySlug(slug);

  // 404 if campaign not found
  if (!campaign) {
    notFound();
  }

  // Fetch statistics
  const stats = await campaignService.getStats(campaign.id);

  // Calculate time-based states
  const now = new Date();
  const startTime = new Date(campaign.startTime);
  const endTime = new Date(campaign.endTime);
  const hasStarted = now >= startTime;
  const hasEnded = now >= endTime;
  const isWithinTimeRange = hasStarted && !hasEnded;
  const showCountdown = !hasStarted && campaign.status === 'active';
  const canPurchase = campaign.status === 'active' && isWithinTimeRange;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <CampaignHeader
        title={campaign.title}
        status={campaign.status}
        startTime={startTime}
        endTime={endTime}
        ticketPrice={campaign.ticketPrice}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Statistics */}
          <CampaignStats stats={stats} />

          {/* Countdown Timer - Only show before start time and if active */}
          {showCountdown && (
            <div>
              <CountdownTimer targetDate={startTime} />
            </div>
          )}

          {/* Two Column Layout: Left (Description + Prizes), Right (Purchase) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Description and Prizes */}
            <div className="lg:col-span-2 space-y-8">
              {/* Campaign Description */}
              <CampaignDescription description={campaign.description} />

              {/* Prize Table */}
              <PrizeTable
                prizes={campaign.prizes}
                ticketPrice={campaign.ticketPrice}
              />
            </div>

            {/* Right Column: Purchase Form or Message */}
            <div className="lg:col-span-1">
              <div className="sticky top-4">
                <PurchaseFormPlaceholder
                  status={campaign.status}
                  isWithinTimeRange={isWithinTimeRange}
                  startTime={startTime}
                  endTime={endTime}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
