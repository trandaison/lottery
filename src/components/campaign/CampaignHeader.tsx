import { Badge } from '@/components/ui/badge';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';

dayjs.locale('vi');

interface CampaignHeaderProps {
  title: string;
  status: 'active' | 'drawing' | 'completed' | 'canceled';
  startTime: Date;
  endTime: Date;
  ticketPrice: number;
}

/**
 * CampaignHeader Component
 * 
 * Displays campaign header information with:
 * - Title and status badge
 * - Start and end time
 * - Ticket price
 * 
 * Architecture:
 * - Single responsibility: Display campaign header
 * - Pure presentational component
 * - Status-based styling
 */
export function CampaignHeader({
  title,
  status,
  startTime,
  endTime,
  ticketPrice,
}: CampaignHeaderProps) {
  const statusConfig = {
    active: {
      label: 'Đang diễn ra',
      variant: 'default' as const,
      className: 'bg-green-500 hover:bg-green-600',
    },
    drawing: {
      label: 'Đang quay số',
      variant: 'default' as const,
      className: 'bg-blue-500 hover:bg-blue-600',
    },
    completed: {
      label: 'Đã hoàn thành',
      variant: 'secondary' as const,
      className: '',
    },
    canceled: {
      label: 'Đã hủy',
      variant: 'destructive' as const,
      className: '',
    },
  };

  const config = statusConfig[status];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return dayjs(date).format('HH:mm - DD/MM/YYYY');
  };

  return (
    <div className="border-b bg-white">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="font-medium">Bắt đầu:</span>
                <span>{formatDateTime(startTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Kết thúc:</span>
                <span>{formatDateTime(endTime)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Giá vé:</span>
                <span className="font-semibold text-green-600">
                  {formatCurrency(ticketPrice)}
                </span>
              </div>
            </div>
          </div>
          <Badge
            variant={config.variant}
            className={`${config.className} px-4 py-2 text-base whitespace-nowrap`}
          >
            {config.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
