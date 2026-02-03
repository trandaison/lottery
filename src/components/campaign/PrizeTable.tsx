import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatPrizeValueDisplay } from '@/lib/utils/prize-value';
import type { CampaignPrizeDTO } from '@/types';

interface PrizeTableProps {
  prizes: CampaignPrizeDTO[];
  ticketPrice?: number;
  totalRevenue?: number;
  prizeValueType?: 'fixed' | 'percent';
}

/**
 * PrizeTable Component
 *
 * Displays campaign prizes in a table format with:
 * - Prize title and count
 * - Matching digits (for winning)
 * - Prize value
 * - Winning odds
 *
 * Architecture:
 * - Single responsibility: Display prizes only
 * - Reusable across different pages
 * - Uses shadcn/ui components for consistency
 */
export function PrizeTable({ prizes, ticketPrice: _ticketPrice, totalRevenue, prizeValueType = 'fixed' }: PrizeTableProps) {
  // Calculate odds (simplified for display)
  const calculateOdds = (matchingDigits: number) => {
    const totalCombinations = Math.pow(10, matchingDigits);
    return `1/${totalCombinations.toLocaleString('vi-VN')}`;
  };

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4">Danh sách giải thưởng</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Giải thưởng</TableHead>
              <TableHead className="text-center">Số chữ số</TableHead>
              <TableHead className="text-center">Số lượng</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prizes.map((prize) => (
              <TableRow key={prize.id}>
                <TableCell className="font-medium">{prize.title}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{prize.matchingDigits} số</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{prize.prizesCount}</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  {formatPrizeValueDisplay(prize, totalRevenue, prizeValueType)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
