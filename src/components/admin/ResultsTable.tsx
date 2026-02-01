'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Play, ChevronDown, ChevronUp } from 'lucide-react';
import type { PrizeWithDrawStatus } from '@/types';

interface ResultsTableProps {
  prizes: PrizeWithDrawStatus[];
  onDraw: (prizeId: number) => void;
  onRedo: (winningNumberId: number) => void;
  isDrawing: boolean;
  currentDrawingPrizeId: number | null;
}

/**
 * ResultsTable Component
 *
 * Displays prizes with draw status, winning numbers, and action buttons.
 * - Shows placeholders (underscores) for not drawn prizes
 * - Shows loading spinner during draw
 * - Shows winning numbers after draw
 * - Expandable rows to show winners list
 */
export function ResultsTable({
  prizes,
  onDraw,
  onRedo,
  isDrawing,
  currentDrawingPrizeId,
}: ResultsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (prizeId: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(prizeId)) {
        newSet.delete(prizeId);
      } else {
        newSet.add(prizeId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: PrizeWithDrawStatus['drawStatus']) => {
    switch (status) {
      case 'not_drawn':
        return <Badge variant="outline">Chưa quay</Badge>;
      case 'drawn':
        return <Badge variant="secondary">Đã quay một phần</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">Hoàn thành</Badge>;
      default:
        return null;
    }
  };

  const renderWinningNumberDisplay = (prize: PrizeWithDrawStatus) => {
    if (isDrawing && currentDrawingPrizeId === prize.id) {
      // Show loading spinner during draw
      return (
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <span className="text-muted-foreground">Đang quay...</span>
        </div>
      );
    }

    if (prize.winningNumbers.length === 0) {
      // Show placeholder with underscores matching matchingDigits
      const placeholder = '_'.repeat(prize.matchingDigits);
      return (
        <span className="font-mono text-2xl font-bold text-gray-400">{placeholder}</span>
      );
    }

    // Show winning numbers
    return (
      <div className="flex flex-wrap gap-2">
        {prize.winningNumbers.map((wn) => {
          // Pad number to matchingDigits for display
          const displayNumber = wn.number.padStart(prize.matchingDigits, '0');
          return (
            <span
              key={wn.id}
              className="rounded-lg bg-blue-100 px-3 py-1 font-mono text-xl font-bold text-blue-900"
            >
              {displayNumber}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full">
          <tbody>
            {prizes.map((prize) => {
              const isExpanded = expandedRows.has(prize.id);
              const canDraw = prize.drawStatus !== 'completed';
              const hasWinningNumbers = prize.winningNumbers.length > 0;
              const isCurrentDrawing = isDrawing && currentDrawingPrizeId === prize.id;

              return (
                <>
                  <tr key={prize.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="inline-flex items-baseline gap-2 font-medium">
                        {prize.title} <Badge variant="outline">{prize.prizesCount} Giải</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {prize.prizeValue.toLocaleString('vi-VN')} VNĐ/Giải
                      </div>
                    </td>
                    <td className="px-4 py-3">{renderWinningNumberDisplay(prize)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {canDraw && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onDraw(prize.id)}
                            disabled={isDrawing}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Quay giải
                          </Button>
                        )}
                        {hasWinningNumbers && !isCurrentDrawing && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                // Redo the most recent winning number
                                const latestWinningNumber = prize.winningNumbers[prize.winningNumbers.length - 1];
                                if (latestWinningNumber) {
                                  onRedo(latestWinningNumber.id);
                                }
                              }}
                              disabled={isDrawing}
                            >
                              <RotateCcw className="mr-1 h-4 w-4" />
                              Redo
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleRow(prize.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row showing winners */}
                  {isExpanded && hasWinningNumbers && (
                    <tr key={`${prize.id}-expanded`}>
                      <td colSpan={6} className="px-4 py-4 bg-muted/30">
                        <div className="space-y-3">
                          {prize.winningNumbers.map((wn) => (
                            <div key={wn.id} className="rounded-lg border bg-background p-4">
                              <div className="mb-2 font-semibold">
                                Số trúng: <span className="font-mono">{wn.number.padStart(prize.matchingDigits, '0')}</span>
                              </div>
                              {wn.winners && wn.winners.length > 0 ? (
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-muted-foreground">
                                    Người trúng ({wn.winners.length}):
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {wn.winners.map((winner) => (
                                      <div
                                        key={winner.userId}
                                        className="rounded border p-2 text-sm"
                                      >
                                        <div className="font-medium">{winner.name}</div>
                                        <div className="text-muted-foreground">
                                          {winner.email}
                                        </div>
                                        <div className="mt-1 font-mono text-xs">
                                          Vé: {winner.ticketNumbers.join(', ')}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  Không có vé trúng giải
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
