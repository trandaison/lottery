import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CampaignPrizeDTO } from '@/types';

interface PrizeTableProps {
  prizes: CampaignPrizeDTO[];
  ticketPrice: number;
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
export function PrizeTable({ prizes, ticketPrice }: PrizeTableProps) {
  // Format currency in VND
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

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
              <TableHead className="text-center">Số lượng</TableHead>
              <TableHead className="text-center">Số chữ số trúng</TableHead>
              <TableHead className="text-right">Giá trị</TableHead>
              <TableHead className="text-center">Tỷ lệ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prizes.map((prize) => (
              <TableRow key={prize.id}>
                <TableCell className="font-medium">{prize.title}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{prize.prizesCount}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{prize.matchingDigits} số</Badge>
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600">
                  {formatCurrency(prize.prizeValue)}
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {calculateOdds(prize.matchingDigits)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
