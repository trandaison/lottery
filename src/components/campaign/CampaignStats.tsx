import { Users, Ticket, DollarSign } from 'lucide-react';
import type { CampaignStatistics } from '@/types';

interface CampaignStatsProps {
  stats: CampaignStatistics;
}

/**
 * CampaignStats Component
 * 
 * Displays campaign statistics with:
 * - Tickets sold count
 * - Participants count
 * - Total revenue
 * 
 * Architecture:
 * - Single responsibility: Display statistics
 * - Uses lucide-react icons for visual appeal
 * - Responsive grid layout
 */
export function CampaignStats({ stats }: CampaignStatsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const statItems = [
    {
      icon: Ticket,
      label: 'Vé đã bán',
      value: formatNumber(stats.ticketsSold),
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Users,
      label: 'Người tham gia',
      value: formatNumber(stats.participantsCount),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      icon: DollarSign,
      label: 'Tổng doanh thu',
      value: formatCurrency(stats.totalRevenue),
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {statItems.map((item) => (
        <div
          key={item.label}
          className="bg-white rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className={`${item.bgColor} p-3 rounded-lg`}>
              <item.icon className={`w-6 h-6 ${item.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-1">{item.label}</p>
              <p className={`text-2xl font-bold ${item.color}`}>
                {item.value}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
